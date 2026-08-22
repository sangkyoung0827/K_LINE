import { GoogleGenAI } from "@google/genai";
import { auth } from "@/auth";
import { getAdminAccess } from "@/lib/admin";
import {
  detectBusinessCollectionRequest,
  runEphemeralBusinessDataPipeline
} from "@/lib/business-data/ephemeral-pipeline";
import { formatKnowledgeContext, searchKnowledge } from "@/lib/knowledge/search";
import { supabaseRequest } from "@/lib/supabaseServer";
import { buildTraditionalLiquorAssistantContext, isTraditionalLiquorQuestion } from "@/lib/traditional-liquor/assistant-context";

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
const externalSearchTimeoutMs = 6_500;

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
11. WooHyukmon 4.0 answers grounded in Knowledge DB sources supplied by the server
12. WooHyukmon 4.0 traditional liquor market analysis grounded in Traditional Liquor DB records supplied by the server
13. WooHyukmon 4.0 one-time public business-data collection and Data Analytics reports supplied by the server

Security and permission rules:
- Never reveal the ECC official team chat link or QR code unless the system-provided user context says the user is an approved official member.
- Never claim that a user has been approved unless the system-provided user context confirms it.
- Never approve payments, change roles, or modify member status.
- Never expose developer information, admin-only data, private member information, API keys, environment variables, database structure, or hidden routes.
- Knowledge DB and Traditional Liquor DB context may be supplied to any WooHyukmon 4.0 user. Use only the server-supplied excerpts and never infer records that are not present.
- Never reveal raw member names, email addresses, contact details, payment identifiers, team-chat links, QR codes, API keys, environment variables, internal database identifiers, or hidden admin routes from any supplied context.
- Analyze stored traditional-liquor products and price observations, but never claim that missing or stale records are current facts.
- For traditional-liquor questions, treat Traditional Liquor DB records as the primary source. Use external search results only when the DB has no usable records for the request or the user explicitly requests additional/current web research. Clearly distinguish DB facts from externally researched facts.
- For an ephemeral business-data report, use the supplied Data Analytics context. Never claim that temporary rows were saved to the permanent K_LINE Production database. State limitations when search evidence does not contain verified sales volume, market share, or demographic data.
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
- When private Knowledge DB sources are supplied and used, end with a short "참고 자료" or "Sources" list containing only the source file names and page/section when available.
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

function buildWoohyukmonSystemInstruction(history: ClientMessage[], mode = "chat", attachmentNames: string[] = [], modelVersion = "4") {
  const conversationRule =
    history.length === 0
      ? "This is the first reply in this chat. A short natural greeting is allowed once, but answer the user's request immediately."
      : "This is an ongoing chat. Do not greet the user again. Continue naturally from the question and prior conversation.";

  const postDraftRule =
    mode === "post_draft"
      ? `\n\nWoohyukmon ${modelVersion}.0 board draft task:\n- Draft an ECC free-board post from the user's request and the attached file names.\n- Start with exactly \"제목: \" for Korean or \"Title: \" for English, followed by a concise title.\n- Then write \"내용:\" or \"Content:\" and a finished post body.\n- Do not say the post has already been uploaded. The user must confirm publication separately.\n- Attached files: ${attachmentNames.join(", ") || "none"}.`
      : "";

  return `${woohyukmonSystemInstruction}

Conversation continuity:
- ${conversationRule}
- Do not repeatedly introduce yourself or repeat K_LINE, ECC, Han-hwal, membership, or site navigation unless the user asks about that subject.
- Focus on the user's exact request. If the subject changes, follow the new subject without redirecting it back to club information.
- WooHyukmon 4.0 can read server-supplied Knowledge DB, Traditional Liquor DB, and non-identifying K_LINE operational summaries for every user. This is read-only access and never grants admin actions.
- Never claim that you can view, edit, upload, publish, approve, or change live K_LINE data unless the server explicitly provides that authorized live action or data.${postDraftRule}`;
}

async function buildPublicV4OperationalContext(message: string) {
  const normalized = message.toLowerCase();
  const wantsFund = /자금|잔액|후원금|fund|balance|donation/.test(normalized);
  const wantsApplications = /신청.*(?:현황|수|명단)|application.*(?:count|status)|신청자/.test(normalized);
  const wantsMembers = /회원.*(?:현황|수|명단)|member.*(?:count|status|summary)|가입자/.test(normalized);
  if (!wantsFund && !wantsApplications && !wantsMembers) return "";

  const lines = [
    "WOOHYUKMON 4.0 READ-ONLY K_LINE OPERATIONAL SUMMARY",
    "Use aggregate values only. Never reveal or infer names, emails, contact details, payment identifiers, or applicant records."
  ];

  if (wantsFund) {
    const rows = await supabaseRequest<Array<{ displayed_balance_krw: number; total_donation_krw: number; updated_at: string }>>(
      "ecc_fund_settings?select=displayed_balance_krw,total_donation_krw,updated_at&id=eq.ecc&limit=1"
    );
    const fund = rows[0];
    lines.push(fund
      ? `ECC fund aggregate: displayed balance ${Number(fund.displayed_balance_krw)} KRW; cumulative donations ${Number(fund.total_donation_krw)} KRW; updated ${fund.updated_at}.`
      : "ECC fund aggregate: no stored record.");
  }

  if (wantsApplications) {
    const rows = await supabaseRequest<Array<{ activity_id: string; activity_title: string | null; status: string }>>(
      "ecc_activity_applications?select=activity_id,activity_title,status&limit=2000"
    );
    const grouped = rows.reduce<Record<string, number>>((counts, row) => {
      const key = row.activity_title || row.activity_id;
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
    lines.push(`ECC activity application aggregate: total ${rows.length}; by activity ${JSON.stringify(grouped)}.`);
  }

  if (wantsMembers) {
    const [roles, siteMembers] = await Promise.all([
      supabaseRequest<Array<{ official_member_status: string | null }>>("ecc_roles?select=official_member_status&limit=2000"),
      supabaseRequest<Array<{ email: string }>>("site_members?select=email&limit=2000")
    ]);
    lines.push(`K_LINE member aggregate: registered users ${new Set(siteMembers.map((row) => row.email.toLowerCase())).size}; approved ECC official members ${roles.filter((row) => row.official_member_status === "approved").length}.`);
  }

  return lines.join("\n");
}

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

function explicitlyRequestsExternalResearch(message: string) {
  return /(?:외부|인터넷|웹|구글|네이버)\s*(?:검색|조사)|추가\s*(?:검색|조사)|search\s+(?:the\s+)?web|external\s+(?:search|research)|latest\s+(?:news|web)/i.test(message);
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
    },
    signal: AbortSignal.timeout(externalSearchTimeoutMs)
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
      },
      signal: AbortSignal.timeout(externalSearchTimeoutMs)
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
    },
    signal: AbortSignal.timeout(externalSearchTimeoutMs)
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
    }),
    signal: AbortSignal.timeout(externalSearchTimeoutMs)
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
  businessReport = false,
  controller,
  externalSearchContext = "",
  history,
  message,
  mode,
  attachmentNames,
  modelVersion
}: {
  ai: GoogleGenAI;
  businessReport?: boolean;
  controller: ReadableStreamDefaultController<Uint8Array>;
  externalSearchContext?: string;
  history: ClientMessage[];
  message: string;
  mode?: string;
  attachmentNames?: string[];
  modelVersion?: string;
}) {
  const responseStream = await ai.models.generateContentStream({
    model: getGeminiModel(),
    contents: buildContents(message, history, externalSearchContext),
    config: {
      systemInstruction: buildWoohyukmonSystemInstruction(history, mode, attachmentNames, modelVersion),
      temperature: externalSearchContext ? 0.12 : 0.35,
      maxOutputTokens: businessReport ? 1_100 : getMaxOutputTokens(),
      ...(businessReport ? { thinkingConfig: { thinkingBudget: 0 } } : {})
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

  let body: { attachmentNames?: unknown; message?: unknown; history?: unknown; mode?: unknown; modelVersion?: unknown };

  try {
    body = (await request.json()) as { attachmentNames?: unknown; message?: unknown; history?: unknown; mode?: unknown; modelVersion?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  const history = cleanMessages(body.history);
  const mode = body.mode === "post_draft" ? "post_draft" : "chat";
  const modelVersion = body.modelVersion === "2" || body.modelVersion === "3" ? body.modelVersion : "4";
  const isPublicV4 = modelVersion === "4";
  const attachmentNames = Array.isArray(body.attachmentNames)
    ? body.attachmentNames
        .filter((name): name is string => typeof name === "string")
        .map((name) => name.trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const ai = new GoogleGenAI({ apiKey });
  const session = await auth();
  const developerAccess = await getAdminAccess(session?.user?.email ?? "");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const configuredProviders = getConfiguredSearchProviders();
        const businessCollectionRequest = isPublicV4
          ? detectBusinessCollectionRequest(message)
          : null;
        const traditionalLiquorQuestion = (developerAccess.isDeveloper || isPublicV4) && isTraditionalLiquorQuestion(message);
        const traditionalLiquor = traditionalLiquorQuestion
          ? await buildTraditionalLiquorAssistantContext(message).catch((error) => {
              console.error("WooHyukmon traditional liquor retrieval failed", error);
              return null;
            })
          : null;
        const operationalContext = isPublicV4
          ? await buildPublicV4OperationalContext(message).catch((error) => {
              console.error("WooHyukmon operational summary retrieval failed", error);
              return "";
            })
          : "";
        const databaseProviders = [
          ...(traditionalLiquor?.hasRecords ? ["Traditional Liquor DB"] : []),
          ...(operationalContext ? ["K_LINE Operational DB"] : [])
        ];
        const needsExternalSearch = Boolean(businessCollectionRequest)
          || explicitlyRequestsExternalResearch(message)
          || (databaseProviders.length === 0 && (!traditionalLiquorQuestion || !traditionalLiquor?.hasRecords));

        controller.enqueue(
          ndjson({
            type: "status",
            status: businessCollectionRequest
              ? "business_collection_started"
              : needsExternalSearch
                ? "external_search_started"
                : "database_search_started",
            label: businessCollectionRequest
              ? `비즈니스 데이터 수집 시작 · ${configuredProviders.join(" · ")}`
              : needsExternalSearch
                ? `${configuredProviders.join(" · ")} 검색 중`
                : `${databaseProviders.join(" · ")} 조회 완료`,
            providers: needsExternalSearch ? configuredProviders : databaseProviders,
            sourceCount: (traditionalLiquor?.hasRecords ? 1 : 0) + (operationalContext ? 1 : 0)
          })
        );

        const { results: externalResults, usedProviders } = needsExternalSearch
          ? await searchExternalSources(businessCollectionRequest?.query ?? message)
          : { results: [], usedProviders: [] };
        const businessCollection = businessCollectionRequest
          ? runEphemeralBusinessDataPipeline(businessCollectionRequest, externalResults)
          : null;
        if (businessCollection) {
          const pipelineSteps = [
            ["business_staging_done", `Staging 완료 · ${businessCollection.summary.stagedRows}행`],
            ["business_resolution_done", `Entity Resolution 완료 · ${businessCollection.summary.entityCount}개 출처`],
            ["business_approval_done", `자동 승인 완료 · ${businessCollection.summary.approvedRows}행`],
            ["business_analytics_started", "일회성 Production 스냅샷 · Data Analytics 실행 중"]
          ];
          for (const [status, label] of pipelineSteps) {
            controller.enqueue(ndjson({
              type: "status",
              status,
              label,
              providers: [...usedProviders, "Data Analytics"],
              sourceCount: businessCollection.summary.approvedRows
            }));
          }
        }
        const knowledgeResults = !businessCollectionRequest && (developerAccess.isDeveloper || isPublicV4)
          ? await searchKnowledge({ limit: 8, query: message }).catch((error) => {
              console.error("WooHyukmon private knowledge retrieval failed", error);
              return [];
            })
          : [];
        const traditionalLiquorContext = traditionalLiquor?.text ?? "";
        const businessCollectionContext = businessCollection?.context ?? "";
        const knowledgeSources = developerAccess.isDeveloper
          ? knowledgeResults.map((result) => ({
              title: result.fileName,
              url: `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://kline-nine-wheat.vercel.app"}/developer/woohyukmon-training?file=${encodeURIComponent(result.fileId)}`
            }))
          : [];
        const externalSources = externalResults.map((result) => ({
          title: result.title,
          url: result.url
        }));

        const allSources = [...knowledgeSources, ...externalSources];
        const publicKnowledgeCount = isPublicV4 && !developerAccess.isDeveloper ? knowledgeResults.length : 0;
        const groundedContextCount = allSources.length
          + publicKnowledgeCount
          + (traditionalLiquorContext ? 1 : 0)
          + (operationalContext ? 1 : 0)
          + (businessCollectionContext ? 1 : 0);
        const allProviders = [
          ...(knowledgeResults.length > 0 ? ["WooHyukmon DB"] : []),
          ...(traditionalLiquorContext ? ["Traditional Liquor DB"] : []),
          ...(operationalContext ? ["K_LINE Operational DB"] : []),
          ...(businessCollectionContext ? ["Data Analytics"] : []),
          ...usedProviders
        ];

        if (groundedContextCount > 0) {
          controller.enqueue(
            ndjson({
              type: "grounding",
              groundingChunks: allSources,
              providers: allProviders,
              sourceCount: groundedContextCount,
              webSearchQueries: needsExternalSearch ? [message] : []
            })
          );
          controller.enqueue(
            ndjson({
              type: "status",
              status: needsExternalSearch ? "external_search_done" : "database_search_done",
              label: `${allProviders.join(" · ") || "검색"} 조회 완료 · ${groundedContextCount}개 자료 확인`,
              providers: allProviders,
              sourceCount: groundedContextCount
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
            providers: allProviders,
            sourceCount: groundedContextCount
          })
        );

        await streamGeminiAnswer({
          ai,
          businessReport: Boolean(businessCollectionContext),
          controller,
          externalSearchContext: [
            developerAccess.isDeveloper || isPublicV4 ? formatKnowledgeContext(knowledgeResults) : "",
            traditionalLiquorContext,
            operationalContext,
            businessCollectionContext,
            buildExternalSearchContext(externalResults)
          ].filter(Boolean).join("\n\n"),
          history,
          message,
          mode,
          attachmentNames,
          modelVersion
        });

        if (businessCollection) {
          controller.enqueue(ndjson({
            type: "status",
            status: "business_collection_purged",
            label: "보고서 생성 완료 · 임시 수집 데이터 폐기",
            providers: ["Data Analytics"]
          }));
        }
        controller.enqueue(
          ndjson({
            type: "done",
            grounded: groundedContextCount > 0,
            groundingChunks: allSources,
            providers: allProviders,
            sourceCount: groundedContextCount,
            webSearchQueries: needsExternalSearch ? [message] : []
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
