import { cleanHanhwalHistory, hanhwalKnowledge } from "@/lib/hanhwalPublic";
import { generateAnswer, hasGenerationProvider } from "@/lib/woohyukmon/generation";

export const maxDuration = 30;

const requestLog = new Map<string, number[]>();

function clientKey(request: Request) {
  return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "anonymous";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((time) => now - time < 60_000);
  recent.push(now);
  requestLog.set(key, recent);
  return recent.length > 10;
}

const systemInstruction = `You are Solbam (설밤), the friendly leopard mascot and public guide for Hanhwal (한활).

Answer questions about Hanhwal and Korean traditional archery using only the public club knowledge supplied below.
- Match the user's language. Use simple English for international students and natural Korean for Korean questions.
- Give the direct answer first and stay concise, usually within 2–5 short paragraphs.
- For safety or technique, remind the user to follow the instructor at the field.
- Never claim that a general archery fact is an official Hanhwal rule unless the supplied knowledge says so.
- Never expose or guess private member, payment, financial, team-chat, or administrator information.
- If the supplied knowledge does not answer the question, say you are unsure and recommend asking a Hanhwal instructor or officer.
- Do not use markdown tables or headings. Lists are allowed when they improve safety instructions.

${hanhwalKnowledge}`;

export async function POST(request: Request) {
  if (!hasGenerationProvider()) {
    return Response.json({ error: "Solbam is taking a short break. Please try again later." }, { status: 503 });
  }

  if (isRateLimited(clientKey(request))) {
    return Response.json({ error: "Too many questions. Please wait a minute and try again." }, { status: 429 });
  }

  let body: { message?: unknown; history?: unknown };

  try {
    body = await request.json() as { message?: unknown; history?: unknown };
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1_000) {
    return Response.json({ error: "Please enter a question within 1,000 characters." }, { status: 400 });
  }

  try {
    const result = await generateAnswer({
      system: systemInstruction,
      history: cleanHanhwalHistory(body.history),
      message,
      maxTokens: 900,
      temperature: 0.2
    });

    return Response.json({ answer: result.answer });
  } catch {
    return Response.json({ error: "Solbam could not answer right now. Please try again later." }, { status: 503 });
  }
}
