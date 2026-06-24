import OpenAI from "openai";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminAccess } from "@/lib/admin";
import { getEccAccessForEmail } from "@/lib/eccAccess";
import { buildWoohyukmonAssistantContext } from "@/lib/woohyukmonAssistant";
import { buildWoohyukmonContext } from "@/lib/woohyukmonContext";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

type CachedAnswer = {
  answer: string;
  expiresAt: number;
  fallback?: boolean;
  provider: string;
};

type ProviderBudgetState = {
  cooldownUntil: number;
  requests: number[];
};

const answerCache = new Map<string, CachedAnswer>();
const providerBudgets = new Map<string, ProviderBudgetState>();
const systemPrompt = `You are 우혁몬, the core AI assistant for the K_LINE website. K_LINE is a campus-based community platform for university students, especially international students and student communities. You help with club administration, site guidance, activity planning, copywriting, and finding visible posts or records. Use the provided K_LINE knowledge base, role context, and searchable records first. Answer in the same language as the user. Be friendly, concise, accurate, and practical. Do not invent facts. If the information is not available, say so and guide the user to the relevant visible page or Contact.`;

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
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 900)
    }));
}

function isKorean(text: string) {
  return /[가-힣]/.test(text);
}

function isQuotaError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; status?: unknown };
  return candidate.status === 429 || candidate.code === "insufficient_quota";
}

function isProviderAccessError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { status?: unknown };
  return candidate.status === 401 || candidate.status === 403;
}

function getAiProvider() {
  return (process.env.AI_PROVIDER?.trim().toLowerCase() || "openai") as "gemini" | "openai";
}

function getWoohyukmonModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";
}

function getGeminiRequestsPerMinuteLimit() {
  const parsed = Number.parseInt(process.env.GEMINI_RPM_LIMIT ?? "", 10);

  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 15) {
    return parsed;
  }

  return 12;
}

function getWoohyukmonCacheTtlMs() {
  const parsed = Number.parseInt(process.env.WOOHYUKMON_CACHE_TTL_SECONDS ?? "", 10);

  if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 600) {
    return parsed * 1000;
  }

  return 120 * 1000;
}

function getWoohyukmonCooldownMs() {
  const parsed = Number.parseInt(process.env.WOOHYUKMON_GEMINI_COOLDOWN_SECONDS ?? "", 10);

  if (Number.isFinite(parsed) && parsed >= 30 && parsed <= 3600) {
    return parsed * 1000;
  }

  return 75 * 1000;
}

function getWoohyukmonMaxTokens() {
  const parsed = Number.parseInt(process.env.OPENAI_MAX_TOKENS ?? "", 10);

  if (Number.isFinite(parsed) && parsed >= 200 && parsed <= 1800) {
    return parsed;
  }

  return 520;
}

function compactCacheText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}

function cacheKey(input: {
  email: string;
  history: ClientMessage[];
  includeGoods: boolean;
  includeProjects: boolean;
  message: string;
  provider: string;
  role: string;
}) {
  const privateScope = input.role === "user" ? "public" : input.email || input.role;
  const historyTail = input.history
    .slice(-2)
    .map((message) => `${message.role}:${compactCacheText(message.content)}`)
    .join("|");

  return [
    input.provider,
    privateScope,
    input.role,
    input.includeGoods ? "goods" : "no-goods",
    input.includeProjects ? "projects" : "no-projects",
    compactCacheText(input.message),
    historyTail
  ].join("::");
}

function getCachedAnswer(key: string) {
  const cached = answerCache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    answerCache.delete(key);
    return null;
  }

  return cached;
}

function setCachedAnswer(key: string, answer: string, provider: string, fallback = false) {
  answerCache.set(key, {
    answer,
    expiresAt: Date.now() + getWoohyukmonCacheTtlMs(),
    fallback,
    provider
  });

  if (answerCache.size > 100) {
    const firstKey = answerCache.keys().next().value as string | undefined;
    if (firstKey) {
      answerCache.delete(firstKey);
    }
  }
}

function getProviderBudget(provider: string) {
  const existing = providerBudgets.get(provider);

  if (existing) {
    return existing;
  }

  const created = {
    cooldownUntil: 0,
    requests: []
  };
  providerBudgets.set(provider, created);
  return created;
}

function canCallProvider(provider: string) {
  if (provider !== "gemini") {
    return { allowed: true, reason: "" };
  }

  const now = Date.now();
  const budget = getProviderBudget(provider);

  if (budget.cooldownUntil > now) {
    return { allowed: false, reason: "cooldown" };
  }

  budget.requests = budget.requests.filter((timestamp) => now - timestamp < 60_000);

  if (budget.requests.length >= getGeminiRequestsPerMinuteLimit()) {
    budget.cooldownUntil = now + getWoohyukmonCooldownMs();
    return { allowed: false, reason: "rpm" };
  }

  budget.requests.push(now);
  return { allowed: true, reason: "" };
}

function putProviderOnCooldown(provider: string) {
  if (provider !== "gemini") {
    return;
  }

  getProviderBudget(provider).cooldownUntil = Date.now() + getWoohyukmonCooldownMs();
}

function extractRelevantRecords(context: string) {
  const start = context.indexOf("Relevant searchable records for this message:");

  if (start < 0) {
    return "";
  }

  return context
    .slice(start)
    .split("\n")
    .filter((line) => line.startsWith("- [") || line.trim().startsWith("URL:"))
    .slice(0, 8)
    .join("\n");
}

function fallbackAnswer(message: string, assistantContext: string, provider: string) {
  const ko = isKorean(message);
  const lower = message.toLowerCase();
  const records = extractRelevantRecords(assistantContext);
  const providerLabel = provider === "gemini" ? "Gemini" : "OpenAI";

  if (lower.includes("find") || lower.includes("search") || message.includes("찾")) {
    return ko
      ? `지금 ${providerLabel} 연결이 제한되어 우혁몬의 긴 답변은 잠시 제한되지만, 사이트 기록 검색은 아래처럼 확인할 수 있어요.\n\n${records || "- 현재 조건에 맞는 기록을 찾지 못했습니다. 검색어를 더 구체적으로 입력해 주세요."}`
      : `${providerLabel} is temporarily unavailable, but Woohyukmon can still show matching site records.\n\n${records || "- No matching record was found. Try a more specific keyword."}`;
  }

  if (message.includes("공지") || lower.includes("notice") || lower.includes("kakao")) {
    return ko
      ? `${providerLabel} 연결 제한으로 자동 문장 확장은 잠시 제한됩니다. 대신 바로 쓸 수 있는 기본 공지 틀을 드릴게요.\n\n[공지]\n안녕하세요, ECC 운영진입니다.\n이번 활동 안내드립니다.\n- 활동명:\n- 일시:\n- 장소:\n- 준비물:\n- 회비/납부 여부:\n- 신청 방법:\n참여를 원하는 분들은 마감 시간 전까지 신청해 주세요. 감사합니다.`
      : `${providerLabel} is temporarily unavailable, but here is a copy-ready notice template.\n\n[Notice]\nHello, this is the ECC officer team.\nHere is the information for our next activity.\n- Activity:\n- Date and time:\n- Place:\n- What to bring:\n- Fee/payment status:\n- How to apply:\nPlease apply before the deadline. Thank you.`;
  }

  if (message.includes("아이디어") || lower.includes("idea")) {
    return ko
      ? `${providerLabel} 연결 제한으로 세부 기획은 잠시 제한되지만, 바로 사용할 수 있는 ECC 활동 아이디어를 추천할게요.\n\n1. 캠퍼스 영어 스몰토크 라운드\n2. 국가별 음식/문화 소개 미니 세션\n3. 한국어 단어 카드 교환 활동\n4. 전주 산책 후 영어 후기 공유\n5. 신입회원 웰컴 게임과 팀별 미션`
      : `${providerLabel} is temporarily unavailable, but here are practical ECC activity ideas.\n\n1. Campus small-talk round\n2. Country food and culture mini-session\n3. Korean word exchange cards\n4. Jeonju walk and English reflection\n5. New member welcome games with team missions`;
  }

  return ko
    ? `우혁몬의 ${providerLabel} 응답은 현재 제한되어 있지만, 기본 안내는 가능합니다. ECC는 \`/our-activities/ecc\`, 활동 신청은 \`/our-activities/ecc/activity\`, 게시판은 \`/our-activities/ecc/free-board\`, 문의는 \`/contact\`에서 확인할 수 있습니다.`
    : `Woohyukmon's ${providerLabel} response is temporarily unavailable, but basic guidance is still available. ECC is at \`/our-activities/ecc\`, activity applications are at \`/our-activities/ecc/activity\`, the board is at \`/our-activities/ecc/free-board\`, and contact is at \`/contact\`.`;
}

function buildPromptMessages({
  assistantContext,
  context,
  history,
  message
}: {
  assistantContext: string;
  context: string;
  history: ClientMessage[];
  message: string;
}) {
  return [
    { role: "system" as const, content: systemPrompt },
    {
      role: "system" as const,
      content: `Use this compact K_LINE context before answering:\n\n${context}`
    },
    {
      role: "system" as const,
      content: assistantContext
    },
    ...history,
    { role: "user" as const, content: message.slice(0, 1200) }
  ];
}

async function generateWithGemini(input: {
  assistantContext: string;
  context: string;
  history: ClientMessage[];
  message: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const messages = buildPromptMessages(input);
  const prompt = messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      getGeminiModel()
    )}:generateContent`
  );
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        maxOutputTokens: getWoohyukmonMaxTokens(),
        temperature: 0.35
      }
    })
  });

  if (!response.ok) {
    console.error("Woohyukmon Gemini request failed", {
      provider: "gemini",
      status: response.status,
      statusText: response.statusText
    });
    const error = new Error(`Gemini request failed with status ${response.status}`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  const data = (await response.json()) as GeminiResponse;
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

async function generateWithOpenAI(input: {
  apiKey: string;
  assistantContext: string;
  context: string;
  history: ClientMessage[];
  message: string;
}) {
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  const client = new OpenAI({
    apiKey: input.apiKey,
    ...(baseURL ? { baseURL } : {})
  });
  const response = await client.chat.completions.create({
    model: getWoohyukmonModel(),
    temperature: 0.35,
    max_tokens: getWoohyukmonMaxTokens(),
    messages: buildPromptMessages(input)
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

export async function POST(request: Request) {
  const provider = getAiProvider();
  const apiKey =
    provider === "gemini" ? process.env.GEMINI_API_KEY?.trim() : process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        error: `${provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} is not configured yet. Please add it locally or in Vercel Environment Variables.`
      },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      localBoardPosts?: unknown;
      message?: unknown;
      history?: unknown;
    };
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const session = await auth();
    const email = session?.user?.email ?? "";
    const access = await getAdminAccess(email);
    const eccAccess = await getEccAccessForEmail(email);
    const includeGoods = access.isDeveloper;
    const includeProjects = access.isSuperAdmin;
    const history = cleanMessages(body.history);
    const key = cacheKey({
      email,
      history,
      includeGoods,
      includeProjects,
      message,
      provider,
      role: eccAccess.role
    });
    const cached = getCachedAnswer(key);

    if (cached) {
      return NextResponse.json({
        answer: cached.answer,
        cached: true,
        fallback: cached.fallback,
        provider: cached.provider
      });
    }

    const context = buildWoohyukmonContext({
      includeGoods,
      includeProjects
    });
    const assistantContext = await buildWoohyukmonAssistantContext({
      access: eccAccess,
      includeGoods,
      includeProjects,
      localBoardPosts: body.localBoardPosts,
      query: message
    });
    const budget = canCallProvider(provider);

    if (!budget.allowed) {
      const answer = fallbackAnswer(message, assistantContext, provider);
      setCachedAnswer(key, answer, provider, true);

      return NextResponse.json({
        answer,
        fallback: true,
        provider,
        quotaProtected: true,
        reason: budget.reason
      });
    }

    const answer = await (provider === "gemini"
      ? generateWithGemini({
          assistantContext,
          context,
          history,
          message
        })
      : generateWithOpenAI({
          apiKey,
          assistantContext,
          context,
          history,
          message
      }))
      .catch((error: unknown) => {
        if (isQuotaError(error) || isProviderAccessError(error)) {
          putProviderOnCooldown(provider);
          return "";
        }

        throw error;
      });

    if (!answer) {
      const fallback = fallbackAnswer(message, assistantContext, provider);
      setCachedAnswer(key, fallback, provider, true);

      return NextResponse.json({
        answer: fallback,
        fallback: true,
        provider
      });
    }

    setCachedAnswer(key, answer, provider);

    return NextResponse.json({ answer, provider });
  } catch (error) {
    console.error("Woohyukmon API error", error);
    return NextResponse.json(
      {
        error:
          "Woohyukmon is temporarily unavailable. Please try again later or use the Contact page."
      },
      { status: 500 }
    );
  }
}
