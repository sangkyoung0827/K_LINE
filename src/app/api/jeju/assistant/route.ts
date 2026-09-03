import { GoogleGenAI } from "@google/genai";
import { auth } from "@/auth";
import { buildJejuWoohyukmonContext } from "@/lib/jeju/ai-context";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

type ClientMessage = { role: "user" | "assistant"; content: string };
type GeminiChunkLike = { text?: unknown };

function ndjson(payload: unknown) {
  return encoder.encode(`${JSON.stringify(payload)}\n`);
}

function cleanMessages(value: unknown): ClientMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ClientMessage>;
    if ((candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.content !== "string") return [];
    const content = candidate.content.trim().slice(0, 1400);
    return content ? [{ role: candidate.role, content }] : [];
  }).slice(-8);
}

function modelName() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

const systemInstruction = `You are Woohyukmon, K_LINE's personal Korea journey guide and Memory Book assistant.

Use the private current-user context supplied by the server as your primary evidence.

Recommendation priorities, in order:
1. Experiences similar to places or activities the user rated highly.
2. Nearby places the user has not yet visited.
3. The user's stated interests and preferred activities.
4. Korean cultural experiences that fit those preferences.
5. A natural next stop based on the user's recent movement pattern.

Important constraints:
- ECC and Hanhwal history is preference evidence only. Never recommend rejoining, returning to, or attending future ECC/Hanhwal activities unless the user explicitly asks for club recommendations.
- Never expose exact movement coordinates, email addresses, internal ids, or private profile fields unnecessarily.
- Never invent a stored place, rating, photo, activity, or visit.
- If the saved history is too thin, say what extra record would improve the recommendation instead of pretending certainty.
- Respect allergies and dietary restrictions.
- If the user writes Korean, answer in Korean. If the user writes English, answer in clear simple English.
- Keep recommendations concise and practical. Explain why each recommendation matches the user's history.
- Treat the service as South Korea-wide even if legacy internal names mention Jeju.`;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });

  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return Response.json({ error: "Google login is required." }, { status: 401 });

  let body: { message?: unknown; history?: unknown; currentLocation?: unknown };
  try {
    body = (await request.json()) as { message?: unknown; history?: unknown; currentLocation?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  if (!message) return Response.json({ error: "Message is required." }, { status: 400 });
  const history = cleanMessages(body.history);
  const context = await buildJejuWoohyukmonContext({ email, currentLocation: body.currentLocation });
  const ai = new GoogleGenAI({ apiKey });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(ndjson({ type: "status", label: "K_LINE journey records loaded" }));
        const contents = [
          ...history.map((item) => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.content }] })),
          { role: "user", parts: [{ text: `${context.text}\n\nUSER REQUEST\n${message}` }] }
        ];

        const responseStream = await ai.models.generateContentStream({
          model: modelName(),
          contents,
          config: {
            systemInstruction,
            temperature: 0.25,
            maxOutputTokens: 1300
          }
        });

        for await (const rawChunk of responseStream) {
          const chunk = rawChunk as GeminiChunkLike;
          const text = typeof chunk.text === "string" ? chunk.text.replace(/\*\*/g, "") : "";
          if (text) controller.enqueue(ndjson({ type: "text", text }));
        }
        controller.enqueue(ndjson({ type: "done" }));
      } catch (error) {
        console.error("Woohyukmon journey assistant failed", error);
        controller.enqueue(ndjson({ type: "error", error: "Woohyukmon could not build a journey recommendation right now." }));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "application/x-ndjson; charset=utf-8"
    }
  });
}
