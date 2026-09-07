import { generateAnswer, hasGenerationProvider } from "@/lib/woohyukmon/generation";
import { conversationHistory } from "@/lib/woohyukmon/conversation";
import { auth } from "@/auth";
import { buildJejuWoohyukmonContext } from "@/lib/jeju/ai-context";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function ndjson(payload: unknown) {
  return encoder.encode(`${JSON.stringify(payload)}\n`);
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
  if (!hasGenerationProvider()) return Response.json({ error: "AI providers are not configured." }, { status: 503 });

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
  const history = conversationHistory(body.history);
  const context = await buildJejuWoohyukmonContext({ email, currentLocation: body.currentLocation });
  const cancellation = new AbortController();
  const signal = AbortSignal.any([request.signal, cancellation.signal, AbortSignal.timeout(150_000)]);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const heartbeat = setInterval(() => {
        if (!signal.aborted) {
          try { controller.enqueue(ndjson({ type: "heartbeat" })); }
          catch { cancellation.abort(); }
        }
      }, 10_000);
      try {
        controller.enqueue(ndjson({ type: "status", label: "K_LINE journey records loaded" }));
        const result = await generateAnswer({
          system: systemInstruction,
          history,
          message,
          context: context.text,
          signal,
          temperature: 0.25,
          onProvider(provider, fallback) {
            controller.enqueue(ndjson({ type: "status", label: fallback ? "Reconnecting / 연결 전환 중" : "Preparing answer / 답변 준비 중", providers: [provider] }));
          }
        });
        controller.enqueue(ndjson({ type: "text", text: result.answer.replace(/\*\*/g, "") }));
        controller.enqueue(ndjson({ type: "done" }));
      } catch (error) {
        if (signal.aborted) return;
        console.error("Woohyukmon journey assistant failed", error);
        controller.enqueue(ndjson({ type: "error", error: "Woohyukmon could not build a journey recommendation right now." }));
      } finally {
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* Reader disconnected. */ }
      }
    },
    cancel() {
      cancellation.abort();
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "application/x-ndjson; charset=utf-8"
    }
  });
}
