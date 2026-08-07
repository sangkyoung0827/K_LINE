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

type ExternalSearchResult = GroundingSource & {
  provider: string;
  snippet: string;
};

type GeminiChunkLike = {
  text?: unknown;
};

type DuckDuckGoTopic = {
  FirstURL?: string;
  Text?: string;
  Name?: string;
  Topics?: DuckDuckGoTopic[];
};

type DuckDuckGoResponse = {
  AbstractSource?: string;
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
  RelatedTopics?: DuckDuckGoTopic[];
};

type WikipediaSearchResponse = {
  query?: {
    search?: Array<{
      title?: string;
      snippet?: string;
    }>;
  };
};

type BraveSearchResponse = {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
    }>;
  };
};

type TavilySearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    raw_content?: string;
  }>;
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
10. Web-assisted answers using only the external search sources supplied in the prompt

Security and permission rules:
- Never reveal the ECC official team chat link or QR code unless the system-provided user context says the user is an approved official member.
- Never claim that a user has been approved unless the system-provided user context confirms it.
- Never approve payments, change roles, or modify member status.
- Never expose developer information, admin-only data, private member information, API keys, environment variables, database structure, or hidden routes.
- If a user asks for something restricted, explain that only approved official members or authorized officers can access it.

Answer style:
- Start with the most useful answer.
- Use numbered steps when explaining procedures.
- Keep answers concise but complete.
- For ordinary factual questions, answer in about 4 to 7 short paragraphs or fewer.
- When the user needs to take action, clearly say what button, page, or menu to use.
- Avoid vague phrases such as "you may want to" or "it depends" unless truly necessary.
- Do not invent current facts. If external search sources are supplied, use them as supporting evidence.
- Do not display source numbers like [1], [2] unless the user specifically asks for citation numbers.
- Do not list URLs or sources inside the answer unless the user specifically asks for links.
- Never use markdown bold markers such as **.
- Never write standalone separator lines such as ---.
- Never abbreviate with "중략", "...", "[...]", or a similar omission marker.
- Never stop in the middle of a sentence. If the answer would become long, make it shorter and finish with a complete final sentence.
- If external search sources are not available or do not support the answer, say that web search did not return enough reliable information and continue only with general guidance.

Important behavior:
- For ECC joining questions, guide the user to the ECC new member registration page.
- For payment questions, explain that officers must confirm payment.
- For official member questions, explain that ECC OFFICIAL opens only after officer confirmation.
- For Instagram/contact questions, guide the user to the official ECC Instagram.
- For site navigation questions, give direct page/menu guidance.
- Do not use or assume Google Search Grounding. K_LINE uses external search APIs only.

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

  if (Number.isFinite(parsed) && parsed >= 500 && parsed <= 5000) {
    return parsed;
  }

  return 2600;
}

function ndjson(payload: unknown) {
  return encoder.encode(`${JSON.stringify(payload)}\n`);
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeModelText(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/(^|\n)\s*---+\s*(?=\n|$)/g, "$1")
    .replace(/\[\s*중략\s*\]/g, "")
    .replace(/중략[:：]?\s*/g, "")
    .replace(/\[\.\.\.\]/g, "")
    .replace(/\.\.\.\s*$/g, ".");
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function hasKorean(text: string) {
  return /[가-힣]/.test(text);
}

function getConfiguredSearchProviders() {
  return [
    ...(process.env.TAVILY_API_KEY?.trim() ? ["Tavily"] : []),
    ...(process.env.BRAVE_SEARCH_API_KEY?.trim() ? ["Brave"] : []),
    "DuckDuckGo",
    "Wikipedia"
  ];
}

function buildExternalSearchContext(results: ExternalSearchResult[]) {
  if (results.length === 0) {
    return "";
  }

  const lines = results.slice(0, 8).map((result, index) => {
    const snippet = result.snippet ? `\nSnippet: ${result.snippet}` : "";
    return `Source ${index + 1}: ${result.title}\nURL: ${result.url}\nProvider: ${result.provider}${snippet}`;
  });

  return `External search results are available below. Use them only as supporting evidence. Do not show source numbers, URLs, or a source list in the answer unless the user explicitly asks for links. Do not claim more than these sources support.\n\n${lines.join("\n\n")}`;
}

function buildContents(message: string, history: ClientMessage[], externalSearchContext = "") {
  const userText = externalSearchContext
    ? `${externalSearchContext}\n\nUser question:\n${message.slice(0, 2400)}`
    : message.slice(0, 2400);

  return [
    ...history.map((entry) => ({
      role: entry.role === "assistant" ? "model" : "user",
      parts: [{ text: entry.content }]
    })),
    {
      role: "user",
      parts: [{ text: userText }]
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

function collectDuckDuckGoTopics(topics: DuckDuckGoTopic[], results: ExternalSearchResult[]) {
  for (const topic of topics) {
    if (topic.Topics?.length) {
      collectDuckDuckGoTopics(topic.Topics, results);
      continue;
    }

    const url = asText(topic.FirstURL);
    const text = asText(topic.Text);

    if (!url || !text) {
      continue;
    }

    const [title, ...rest] = text.split(" - ");
    results.push({
      title: title || url,
      url,
      snippet: rest.join(" - ") || text,
      provider: "DuckDuckGo Instant Answer"
    });
  }
}

async function searchDuckDuckGo(query: string): Promise<ExternalSearchResult[]> {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed with status ${response.status}`);
  }

  const data = (await response.json()) as DuckDuckGoResponse;
  const results: ExternalSearchResult[] = [];
  const abstractUrl = asText(data.AbstractURL);
  const abstractText = asText(data.AbstractText);

  if (abstractUrl && abstractText) {
    results.push({
      title: asText(data.Heading) || asText(data.AbstractSource) || abstractUrl,
      url: abstractUrl,
      snippet: abstractText,
      provider: "DuckDuckGo Instant Answer"
    });
  }

  collectDuckDuckGoTopics(data.RelatedTopics ?? [], results);
  return results;
}

async function searchWikipedia(query: string): Promise<ExternalSearchResult[]> {
  const languages = hasKorean(query) ? ["ko", "en"] : ["en", "ko"];
  const results: ExternalSearchResult[] = [];

  for (const language of languages) {
    const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "search");
    url.searchParams.set("srsearch", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("utf8", "1");
    url.searchParams.set("srlimit", "3");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "K_LINE-Woohyukmon/1.0 (https://kline-nine-wheat.vercel.app)"
      }
    });

    if (!response.ok) {
      continue;
    }

    const data = (await response.json()) as WikipediaSearchResponse;

    for (const item of data.query?.search ?? []) {
      const title = asText(item.title);

      if (!title) {
        continue;
      }

      results.push({
        title,
        url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        snippet: stripHtml(asText(item.snippet)),
        provider: `Wikipedia ${language}`
      });
    }
  }

  return results;
}

async function searchBrave(query: string): Promise<ExternalSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();

  if (!apiKey) {
    return [];
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query.slice(0, 400));
  url.searchParams.set("count", "5");
  url.searchParams.set("safesearch", "moderate");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Brave search failed with status ${response.status}`);
  }

  const data = (await response.json()) as BraveSearchResponse;

  return (data.web?.results ?? [])
    .map((result) => ({
      title: asText(result.title) || asText(result.url),
      url: asText(result.url),
      snippet: stripHtml(asText(result.description)),
      provider: "Brave Search API"
    }))
    .filter((result) => result.title && result.url);
}

async function searchTavily(query: string): Promise<ExternalSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();

  if (!apiKey) {
    return [];
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  const data = (await response.json()) as TavilySearchResponse;

  return (data.results ?? [])
    .map((result) => ({
      title: asText(result.title) || asText(result.url),
      url: asText(result.url),
      snippet: stripHtml(asText(result.content) || asText(result.raw_content)),
      provider: "Tavily Search API"
    }))
    .filter((result) => result.title && result.url);
}

function dedupeExternalResults(results: ExternalSearchResult[]) {
  const map = new Map<string, ExternalSearchResult>();

  for (const result of results) {
    if (!result.url || map.has(result.url)) {
      continue;
    }

    map.set(result.url, result);
  }

  return Array.from(map.values()).slice(0, 8);
}

async function searchExternalSources(query: string) {
  const settled = await Promise.allSettled([
    searchTavily(query),
    searchBrave(query),
    searchDuckDuckGo(query),
    searchWikipedia(query)
  ]);

  const results = settled.flatMap((entry) => (entry.status === "fulfilled" ? entry.value : []));
  const dedupedResults = dedupeExternalResults(results);
  const usedProviders = Array.from(new Set(dedupedResults.map((result) => result.provider)));

  return {
    results: dedupedResults,
    usedProviders
  };
}

async function streamGeminiAnswer({
  ai,
  controller,
  externalSearchContext = "",
  history,
  message
}: {
  ai: GoogleGenAI;
  controller: ReadableStreamDefaultController<Uint8Array>;
  externalSearchContext?: string;
  history: ClientMessage[];
  message: string;
}) {
  const responseStream = await ai.models.generateContentStream({
    model: getGeminiModel(),
    contents: buildContents(message, history, externalSearchContext),
    config: {
      systemInstruction: woohyukmonSystemInstruction,
      temperature: externalSearchContext ? 0.12 : 0.35,
      maxOutputTokens: getMaxOutputTokens()
    }
  });

  let emittedText = "";

  for await (const rawChunk of responseStream) {
    const chunk = rawChunk as GeminiChunkLike;
    const text = sanitizeModelText(asText(chunk.text));

    if (text) {
      emittedText += text;
      controller.enqueue(ndjson({ type: "text", text }));
    }
  }

  return emittedText;
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
        const configuredProviders = getConfiguredSearchProviders();

        controller.enqueue(
          ndjson({
            type: "status",
            status: "external_search_started",
            label: `${configuredProviders.join(" · ")} 검색 중`,
            providers: configuredProviders,
            sourceCount: 0
          })
        );

        const { results: externalResults, usedProviders } = await searchExternalSources(message);
        const externalSources = externalResults.map((result) => ({
          title: result.title,
          url: result.url
        }));

        if (externalSources.length > 0) {
          controller.enqueue(
            ndjson({
              type: "grounding",
              groundingChunks: externalSources,
              providers: usedProviders,
              sourceCount: externalSources.length,
              webSearchQueries: [message]
            })
          );
          controller.enqueue(
            ndjson({
              type: "status",
              status: "external_search_done",
              label: `${usedProviders.join(" · ") || "외부 검색"} 검색 완료 · ${externalSources.length}개 자료 확인`,
              providers: usedProviders,
              sourceCount: externalSources.length
            })
          );
        } else {
          controller.enqueue(
            ndjson({
              type: "status",
              status: "external_search_no_results",
              label: "외부 검색 결과 부족 · 일반 답변 준비 중",
              providers: configuredProviders,
              sourceCount: 0
            })
          );
        }

        controller.enqueue(
          ndjson({
            type: "status",
            status: "answer_stream_started",
            label: "우혁몬이 답변을 정리하는 중",
            providers: usedProviders,
            sourceCount: externalSources.length
          })
        );

        await streamGeminiAnswer({
          ai,
          controller,
          externalSearchContext: buildExternalSearchContext(externalResults),
          history,
          message
        });

        controller.enqueue(
          ndjson({
            type: "done",
            grounded: externalSources.length > 0,
            groundingChunks: externalSources,
            providers: usedProviders,
            sourceCount: externalSources.length,
            webSearchQueries: [message]
          })
        );
      } catch (error) {
        console.error("External search Gemini stream failed", getErrorDetail(error));
        controller.enqueue(
          ndjson({
            type: "error",
            error:
              "External search response failed. Check GEMINI_API_KEY, GEMINI_MODEL, BRAVE_SEARCH_API_KEY, or TAVILY_API_KEY."
          })
        );
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
