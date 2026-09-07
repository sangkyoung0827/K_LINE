import type { ConversationMessage } from "./conversation";

type Provider = "gemini" | "nvidia" | "openai" | "compatible";
type Env = Record<string, string | undefined>;
type ProviderConfig = { provider: Provider; key: string; model: string; url: string };
type Budget = { requests: number[]; cooldownUntil: number };
export type GenerationInput = {
  system: string;
  history: ConversationMessage[];
  message: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  onProvider?: (provider: string, fallback: boolean) => void;
};

function credential(value: string | undefined) {
  const key = value?.trim() || "";
  return /redacted/i.test(key) ? "" : key;
}

function configurations(env: Env): ProviderConfig[] {
  const configs: ProviderConfig[] = [
    { provider: "gemini", key: credential(env.GEMINI_API_KEY), model: env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite", url: "https://generativelanguage.googleapis.com/v1beta" },
    { provider: "nvidia", key: credential(env.WOOHYUKMON_NVIDIA_API_KEY || env.NVIDIA_API_KEY), model: env.WOOHYUKMON_NVIDIA_MODEL?.trim() || env.NVIDIA_MODEL?.trim() || "nvidia/nemotron-3.5-lightning-30b-a3b", url: "https://integrate.api.nvidia.com/v1" },
    { provider: "openai", key: credential(env.WOOHYUKMON_OPENAI_API_KEY || env.OPENAI_API_KEY), model: env.WOOHYUKMON_OPENAI_MODEL?.trim() || env.OPENAI_MODEL?.trim() || "gpt-4o-mini", url: env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1" },
    { provider: "compatible", key: credential(env.WOOHYUKMON_COMPATIBLE_API_KEY), model: env.WOOHYUKMON_COMPATIBLE_MODEL?.trim() || "", url: env.WOOHYUKMON_COMPATIBLE_BASE_URL?.trim() || "" }
  ];
  const order = (env.WOOHYUKMON_PROVIDER_ORDER || "gemini,nvidia,openai,compatible").split(",").map((name) => name.trim());
  return [...new Set(order)].flatMap((name) => configs.filter((config) => config.provider === name && config.key && config.model && config.url));
}

export function hasGenerationProvider(env: Env = process.env) {
  return configurations(env).length > 0;
}

class ProviderFailure extends Error {
  constructor(readonly status: number, readonly retryAfterMs = 0) {
    super(`AI provider failed (${status})`);
  }
}

function retryDelay(value: string | null) {
  if (!value) return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(value) - Date.now()) || 0;
}

// Instance-local cooldowns reduce repeat calls; upstream quotas remain authoritative.
export function createAnswerGenerator(options: { env?: Env; fetch?: typeof fetch; now?: () => number; timeoutMs?: number } = {}) {
  const budgets = new Map<string, Budget>();
  const now = options.now || Date.now;
  const request = options.fetch || fetch;
  return async (input: GenerationInput) => {
    const env = options.env || process.env;
    const configuredTimeout = Number(env.WOOHYUKMON_PROVIDER_TIMEOUT_MS);
    const timeoutMs = options.timeoutMs ?? (Number.isFinite(configuredTimeout) && configuredTimeout >= 1000 ? Math.min(configuredTimeout, 30_000) : 25_000);
    const maxTokens = Math.min(Math.max(input.maxTokens || 6000, 500), 8192);
    const prompt = input.context ? `${input.context}\n\nUser question:\n${input.message}` : input.message;
    const messages = [{ role: "system", content: input.system }, ...input.history, { role: "user", content: prompt }];
    let attempted = 0;

    for (const config of configurations(env)) {
      input.signal?.throwIfAborted();
      const budget = budgets.get(config.provider) || { requests: [], cooldownUntil: 0 };
      budgets.set(config.provider, budget);
      if (budget.cooldownUntil > now()) continue;
      budget.requests = budget.requests.filter((time) => now() - time < 60_000);
      const rpm = Math.min(Math.max(Number(env.GEMINI_RPM_LIMIT) || 12, 1), 15);
      if (config.provider === "gemini" && budget.requests.length >= rpm) continue;
      budget.requests.push(now());
      input.onProvider?.(config.provider, attempted > 0 || config.provider !== configurations(env)[0]?.provider);
      attempted++;
      const deadline = AbortSignal.timeout(timeoutMs);
      const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline;
      try {
        const gemini = config.provider === "gemini";
        const url = gemini
          ? `${config.url}/models/${encodeURIComponent(config.model)}:generateContent`
          : `${config.url.replace(/\/$/, "")}/chat/completions`;
        const body = gemini ? {
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [...input.history, { role: "user", content: prompt }].map((message) => ({
            role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }]
          })),
          generationConfig: { temperature: input.temperature ?? 0.35, maxOutputTokens: maxTokens }
        } : {
          model: config.model, messages, temperature: input.temperature ?? 0.35, max_tokens: maxTokens,
          ...(config.provider === "nvidia" ? {
            chat_template_kwargs: config.model.startsWith("deepseek-ai/")
              ? { thinking: false }
              : { enable_thinking: false }
          } : {})
        };
        const response = await request(url, {
          method: "POST", signal,
          headers: { "Content-Type": "application/json", ...(gemini ? { "x-goog-api-key": config.key } : { Authorization: `Bearer ${config.key}` }) },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new ProviderFailure(response.status, retryDelay(response.headers.get("retry-after")));
        }
        const payload = await response.json();
        const candidate = payload.candidates?.[0];
        const choice = payload.choices?.[0];
        if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT" || payload.promptFeedback?.blockReason || choice?.finish_reason === "content_filter") {
          // Content-policy refusals must not be routed around through another provider.
          return { answer: /[가-힣]/.test(input.message) ? "이 요청에는 답변할 수 없습니다. 다른 질문으로 도와드릴게요." : "I cannot answer that request. I can help with a different question.", provider: config.provider };
        }
        const answer: unknown = gemini
          ? candidate?.content?.parts?.filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text || "").join("")
          : choice?.message?.content;
        if (typeof answer !== "string" || !answer.trim() || candidate?.finishReason === "MAX_TOKENS" || choice?.finish_reason === "length") throw new ProviderFailure(502);
        return { answer: answer.trim(), provider: config.provider };
      } catch (error) {
        input.signal?.throwIfAborted();
        const status = error instanceof ProviderFailure ? error.status : 0;
        budget.cooldownUntil = now() + Math.min(3600_000, Math.max(
          error instanceof ProviderFailure ? error.retryAfterMs : 0,
          status === 429 ? 75_000 : [401, 403, 404, 410].includes(status) ? 300_000 : 15_000
        ));
        // Never log prompts, credentials, or provider response bodies.
        console.warn("Woohyukmon provider unavailable", { provider: config.provider, status });
      }
    }
    throw new Error("All configured AI providers are temporarily unavailable.");
  };
}

export const generateAnswer = createAnswerGenerator();
