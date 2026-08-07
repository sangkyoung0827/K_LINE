import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type GroundingSource = {
  title: string;
  url: string;
};

type GeminiChunkLike = {
  text?: unknown;
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { title?: string; uri?: string } }>;
      webSearchQueries?: string[];
    };
  }>;
  groundingMetadata?: {
    groundingChunks?: Array<{ web?: { title?: string; uri?: string } }>;
    webSearchQueries?: string[];
  };
};

const encoder = new TextEncoder();

const woohyukmonSystemInstruction = `You are Woohyukmon, the official Campus AI Guide for K_LINE.

K_LINE is a campus club platform connected to ECC, international student activities, Korean culture experiences, and official member services.

Your main role is to help users understand and use K_LINE easily.

Core personality:
- Friendly, calm, practical, and clear.
- Speak like a helpful senior club member, not like a generic AI chatbot.
- Give direct guidance first, then explain only when needed.
- Prefer short, action-oriented answers.
- Use simple language for international students.
- Be warm, but do not be overly playful or exaggerated.

Language rules:
- If the user writes in Korean, answer in Korean.
- If the user writes in English, answer in clear and simple English.
- If the user seems to be an international student, use simple English or bilingual Korean-English explanations when helpful.
- Do not mix languages unnecessarily.

Main support areas:
1. ECC new member registration
2. Membership fee guidance
3. Registration status guidance
4. ECC official member access
5. ECC OFFICIAL page guidance
6. ECC official team chat guidance
7. Activity application guidance
8. K_LINE site navigation
9. General questions about ECC, Hanhwal, K_LINE, and campus club activities
10. Web-grounded answers for current or factual questions when Google Search grounding provides sources

Security and permission rules:
- Never reveal the ECC official team chat link or QR code unless the system-provided user context says the user is an approved official member.
- Never claim that a user has been approved unless the system-provided user context confirms it.
- Never approve payments, change roles, or modify member status.
- Never expose developer information, admin-only data, private member information, API keys, environment variables, database structure, or hidden routes.
- If a user asks for something restricted, explain that only approved official members or authorized officers can access it.

Answer style:
- Start with the most useful answer.
- Use numbered steps when explaining procedures.
- Keep answers concise unless the user asks for details.
- When the user needs to take action, clearly say what button, page, or menu to use.
- Avoid vague phrases such as "you may want to" or "it depends" unless truly necessary.
- Do not invent information. If information is not available from K_LINE context or Google Search grounding, say that it should be checked with ECC officers or the official ECC Instagram.

Important behavior:
- For ECC joining questions, guide the user to the ECC new member registration page.
- For payment questions, explain that officers must confirm payment.
- For official member questions, explain that ECC OFFICIAL opens only after officer confirmation.
- For Instagram/contact questions, guide the user to the official ECC Instagram.
- For site navigation questions, give direct page/menu guidance.
- When Google Search grounding is used, stay faithful to the returned sources and do not overstate what they prove.
- If Google Search grounding is unavailable for the API project, clearly say that web search is temporarily unavailable and continue with general Gemini guidance only.

You are not just answering questions. You are helping users complete the correct next step on K_LINE.`;

function cleanMessages(history: unknown): ClientMessage[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((message): message is ClientMessage => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const candidate = message as Partial<ClientMessage>;
      return (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string" &&
        candidate.content.trim().length > 0
      );
    })
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 1400)
    }));
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function getMaxOutputTokens() {
  const parsed = Number.parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? "", 10);

  if (Number.isFinite(parsed) && parsed >= 300 && parsed <= 3000) {
    return parsed;
  }

  return 1200;
}

function ndjson(payload: unknown) {
  return encoder.encode(`${JSON.stringify(payload)}\n`);
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseGroundingMetadata(chunk: GeminiChunkLike) {
  return chunk.candidates?.[0]?.groundingMetadata ?? chunk.groundingMetadata ?? null;
}

function collectGroundingSources(
  chunk: GeminiChunkLike,
  sourceMap: Map<string, GroundingSource>,
  querySet: Set<string>
) {
  const metadata = parseGroundingMetadata(chunk);

  if (!metadata) {
    return { sourcesChanged: false, queriesChanged: false };
  }

  let sourcesChanged = false;
  let queriesChanged = false;

  for (const groundingChunk of metadata.groundingChunks ?? []) {
    const url = asText(groundingChunk.web?.uri);

    if (!url || sourceMap.has(url)) {
      continue;
    }

    sourceMap.set(url, {
      title: asText(groundingChunk.web?.title) || url,
      url
    });
    sourcesChanged = true;
  }

  for (const query of metadata.webSearchQueries ?? []) {
    const normalized = asText(query);

    if (!normalized || querySet.has(normalized)) {
      continue;
    }

    querySet.add(normalized);
    queriesChanged = true;
  }

  return { sourcesChanged, queriesChanged };
}

function buildContents(message: string, history: ClientMessage[]) {
  return [
    ...history.map((entry) => ({
      role: entry.role === "assistant" ? "model" : "user",
      parts: [{ text: entry.content }]
    })),
    {
      role: "user",
      parts: [{ text: message.slice(0, 2400) }]
    }
  ];
}

function getErrorDetail(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  if (typeof error === "string") {
    return error.slice(0, 500);
  }

  try {
    return JSON.stringify(error).slice(0, 500);
  } catch {
    return "Unknown Gemini error";
  }
}

async function streamGeminiAnswer({
  ai,
  controller,
  history,
  message,
  useGoogleSearch
}: {
  ai: GoogleGenAI;
  controller: ReadableStreamDefaultController<Uint8Array>;
  history: ClientMessage[];
  message: string;
  useGoogleSearch: boolean;
}) {
  const sourceMap = new Map<string, GroundingSource>();
  const querySet = new Set<string>();
  const responseStream = await ai.models.generateContentStream({
    model: getGeminiModel(),
    contents: buildContents(message, history),
    config: {
      systemInstruction: woohyukmonSystemInstruction,
      ...(useGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
      temperature: useGoogleSearch ? 0.1 : 0.35,
      maxOutputTokens: getMaxOutputTokens()
    }
  });

  for await (const rawChunk of responseStream) {
    const chunk = rawChunk as GeminiChunkLike;
    const text = asText(chunk.text);
    const { sourcesChanged, queriesChanged } = collectGroundingSources(chunk, sourceMap, querySet);

    if (text) {
      controller.enqueue(ndjson({ type: "text", text }));
    }

    if (sourcesChanged || queriesChanged) {
      controller.enqueue(
        ndjson({
          type: "grounding",
          groundingChunks: Array.from(sourceMap.values()),
          webSearchQueries: Array.from(querySet.values())
        })
      );
    }
  }

  controller.enqueue(
    ndjson({
      type: "done",
      grounded: useGoogleSearch,
      groundingChunks: Array.from(sourceMap.values()),
      webSearchQueries: Array.from(querySet.values())
    })
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  let body: { message?: unknown; history?: unknown };

  try {
    body = (await request.json()) as { message?: unknown; history?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  const history = cleanMessages(body.history);
  const ai = new GoogleGenAI({ apiKey });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(ndjson({ type: "status", status: "grounded_stream_started" }));
        await streamGeminiAnswer({ ai, controller, history, message, useGoogleSearch: true });
      } catch (groundingError) {
        const detail = getErrorDetail(groundingError);
        console.error("Gemini grounded stream failed", detail);

        controller.enqueue(
          ndjson({
            type: "text",
            text:
              "현재 Google Search Grounding 연결이 제한되어 있어 우선 일반 Gemini 답변으로 안내할게요. 최신 정보는 공식 사이트에서 한 번 더 확인해 주세요.\n\n"
          })
        );
        controller.enqueue(
          ndjson({
            type: "status",
            status: "grounding_failed_fallback_started"
          })
        );

        try {
          await streamGeminiAnswer({ ai, controller, history, message, useGoogleSearch: false });
        } catch (fallbackError) {
          console.error("Gemini fallback stream failed", getErrorDetail(fallbackError));
          controller.enqueue(
            ndjson({
              type: "error",
              error:
                "Gemini response failed. Check GEMINI_API_KEY, GEMINI_MODEL, and whether the API project has paid-tier access for Google Search Grounding."
            })
          );
        }
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}
