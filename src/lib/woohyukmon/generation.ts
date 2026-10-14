import type { ConversationMessage } from "./conversation";

type Env = Record<string, string | undefined>;
export class OpenAIGenerationError extends Error {
  constructor(message: string, readonly code: "OPENAI_RESPONSE_INCOMPLETE" | "OPENAI_PLAN_FORMAT_INVALID" | "OPENAI_NOT_CONFIGURED" | "OPENAI_AUTH_FAILED" | "OPENAI_RATE_LIMITED" | "OPENAI_UNAVAILABLE", readonly model: string) { super(message); }
}
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
    if (!key) throw new OpenAIGenerationError("OpenAI server connection is not configured.", "OPENAI_NOT_CONFIGURED", model);
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
      throw new OpenAIGenerationError(response.status === 429 ? "OpenAI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
        : response.status === 401 || response.status === 403 ? "OpenAI 서버 키의 인증 또는 권한을 확인해야 합니다."
        : `OpenAI 응답을 받지 못했습니다 (${response.status}). 다시 시도해 주세요.`, response.status === 429 ? "OPENAI_RATE_LIMITED" : response.status === 401 || response.status === 403 ? "OPENAI_AUTH_FAILED" : "OPENAI_UNAVAILABLE", model);
    }
    const payload = await response.json();
    type Output = { type?: string; phase?: string; content?: { type: string; text?: string }[] };
    const messages: Output[] = (Array.isArray(payload.output) ? payload.output : []).filter((item: Output) => !item.type || item.type === "message");
    const finalMessages = messages.filter(item => item.phase === "final_answer");
    const selected = finalMessages.length ? (input.outputSchema ? finalMessages.slice(-1) : finalMessages) : messages.filter(item => item.phase !== "commentary");
    const content = selected.flatMap(item => item.content || []);
    if (messages.some(item => item.content?.some(part => part.type === "refusal"))) {
      return { answer: /[가-힣]/.test(input.message) ? "AI가 이 요청에 대한 응답을 거절했습니다." : "I cannot answer that request.", provider: "openai" as const, model: payload.model || model, refused: true as const };
    }
    const answer = content.filter((part: { type: string }) => part.type === "output_text").map((part: { text?: string }) => part.text || "").join("").trim();
    if (payload.status !== "completed" || !answer) throw new OpenAIGenerationError("OpenAI 답변이 완료되지 않았습니다. 다시 시도해 주세요.", "OPENAI_RESPONSE_INCOMPLETE", payload.model || model);
    if (input.outputSchema) {
      try { JSON.parse(answer); }
      catch { throw new OpenAIGenerationError("AI 실행 계획의 응답 형식에 오류가 있습니다. 잠시 후 다시 시도해 주세요.", "OPENAI_PLAN_FORMAT_INVALID", payload.model || model); }
    }
    return { answer, provider: "openai" as const, model: payload.model || model };
  };
}

export const generateAnswer = createAnswerGenerator();
