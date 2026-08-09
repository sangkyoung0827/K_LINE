import "server-only";

export class FinanceProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceProviderError";
  }
}

export type FinanceLlmProvider = { generate: (prompt: string, signal: AbortSignal) => Promise<string> };

function getProviderName() {
  const configured = process.env.FINANCE_LLM_PROVIDER?.trim() || process.env.AI_PROVIDER?.trim();
  if (configured && ["gemini", "openai"].includes(configured.toLowerCase())) return configured.toLowerCase();
  // WooHyukmon already uses the project-level Gemini credentials. Finance is
  // private and server-only, so it can safely share that provider by default.
  return process.env.FINANCE_GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() ? "gemini" : "";
}

async function parseProviderResponse(response: Response) {
  if (!response.ok) throw new FinanceProviderError(`Finance AI provider returned ${response.status}.`);
  return response.json() as Promise<unknown>;
}

export function getFinanceLlmProvider(): FinanceLlmProvider {
  const provider = getProviderName();
  if (provider === "gemini") {
    const apiKey = process.env.FINANCE_GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
    const model = process.env.FINANCE_GEMINI_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
    if (!apiKey) throw new FinanceProviderError("FINANCE_GEMINI_API_KEY is not configured.");
    return {
      async generate(prompt, signal) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal,
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.25, maxOutputTokens: 1600 } })
        });
        const data = await parseProviderResponse(response) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
        if (!text) throw new FinanceProviderError("Finance AI provider returned no content.");
        return text;
      }
    };
  }
  if (provider === "openai") {
    const apiKey = process.env.FINANCE_OPENAI_API_KEY?.trim();
    const model = process.env.FINANCE_OPENAI_MODEL?.trim() || "gpt-4o-mini";
    if (!apiKey) throw new FinanceProviderError("FINANCE_OPENAI_API_KEY is not configured.");
    return {
      async generate(prompt, signal) {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST", signal,
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, temperature: 0.25, max_tokens: 1600, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] })
        });
        const data = await parseProviderResponse(response) as { choices?: Array<{ message?: { content?: string } }> };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text) throw new FinanceProviderError("Finance AI provider returned no content.");
        return text;
      }
    };
  }
  throw new FinanceProviderError("Finance AI is not configured. Set FINANCE_LLM_PROVIDER and its server-side key.");
}
