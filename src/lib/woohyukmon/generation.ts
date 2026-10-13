import type { ConversationMessage } from "./conversation";

type Env = Record<string, string | undefined>;
export type GenerationInput = {
  system: string;
  history: ConversationMessage[];
  message: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  outputSchema?: Record<string, unknown>;
  onProvider?: (provider: string, fallback: boolean) => void;
};

export function openAIConfiguration(env: Env = process.env) {
  const key = (env.WOOHYUKMON_OPENAI_API_KEY || env.EVENT_AI_OPENAI_API_KEY || env.OPENAI_API_KEY || "").trim();
  return { key: /redacted|masked|sensitive/i.test(key) ? "" : key, model: env.WOOHYUKMON_OPENAI_MODEL?.trim() || "gpt-6-luna" };
}

export function hasGenerationProvider(env: Env = process.env) {
  return Boolean(openAIConfiguration(env).key);
}

// Responses works with the existing scoped event credential; no provider fallback.
export function createAnswerGenerator(options: { env?: Env; fetch?: typeof fetch; now?: () => number; timeoutMs?: number } = {}) {
  return async (input: GenerationInput) => {
    const { key, model } = openAIConfiguration(options.env || process.env);
    if (!key) throw new Error("OpenAI server connection is not configured.");
    input.signal?.throwIfAborted();
    const deadline = AbortSignal.timeout(options.timeoutMs ?? 90_000);
    const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline;
    input.onProvider?.("openai", false);
    const response = await (options.fetch || fetch)("https://api.openai.com/v1/responses", {
      method: "POST", redirect: "error", cache: "no-store", signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model, store: false, instructions: input.system,
        input: [...input.history, { role: "user", content: input.context ? `${input.context}\n\nUser question:\n${input.message}` : input.message }],
        max_output_tokens: Math.min(Math.max(input.maxTokens || 6000, 500), 8192),
        ...(model.startsWith("gpt-6") || model.startsWith("gpt-5") ? { reasoning: { effort: "low" } } : { temperature: input.temperature ?? 0.35 }),
        ...(input.outputSchema ? { text: { format: { type: "json_schema", name: "club_action", strict: true, schema: input.outputSchema } } } : {})
      })
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(response.status === 429 ? "OpenAI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
        : response.status === 401 || response.status === 403 ? "OpenAI 서버 키의 인증 또는 권한을 확인해야 합니다."
        : `OpenAI 응답을 받지 못했습니다 (${response.status}). 다시 시도해 주세요.`);
    }
    const payload = await response.json();
    const content = (payload.output || []).flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || []);
    if (content.some((part: { type: string }) => part.type === "refusal")) {
      return { answer: /[가-힣]/.test(input.message) ? "이 요청에는 답변할 수 없습니다. 다른 질문으로 도와드릴게요." : "I cannot answer that request. I can help with a different question.", provider: "openai" as const, model: payload.model || model };
    }
    const answer = content.filter((part: { type: string }) => part.type === "output_text").map((part: { text?: string }) => part.text || "").join("").trim();
    if (payload.status !== "completed" || !answer) throw new Error("OpenAI 답변이 완료되지 않았습니다. 다시 시도해 주세요.");
    return { answer, provider: "openai" as const, model: payload.model || model };
  };
}

export const generateAnswer = createAnswerGenerator();
