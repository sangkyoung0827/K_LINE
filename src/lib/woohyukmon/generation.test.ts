import assert from "node:assert/strict";
import { test } from "node:test";
import { createAnswerGenerator, hasGenerationProvider } from "./generation";
import { conversationHistory } from "./conversation";

const env = { GEMINI_API_KEY: "test-gemini", NVIDIA_API_KEY: "test-nvidia", OPENAI_API_KEY: "test-openai" };
const input = { system: "Keep the ECC notice style.", history: [{ role: "user" as const, content: "Remember the autumn registration." }, { role: "assistant" as const, content: "We are preparing it." }], message: "Write the notice.", context: "Uploaded training source: ECC autumn notice." };
const openaiAnswer = (answer = "Complete notice") => Response.json({ choices: [{ finish_reason: "stop", message: { content: answer } }] });
const geminiAnswer = () => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Gemini answer" }] } }] });

test("Gemini 429 moves to NVIDIA with identical history and training evidence", async () => {
  const calls: Array<{ url: string; body: any }> = [];
  const statuses: boolean[] = [];
  const generate = createAnswerGenerator({ env, fetch: async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return calls.length === 1 ? new Response("", { status: 429 }) : openaiAnswer();
  } });
  const result = await generate({ ...input, onProvider: (_, fallback) => statuses.push(fallback) });
  assert.equal(result.provider, "nvidia");
  assert.deepEqual(statuses, [false, true]);
  assert.match(calls[1].body.messages.at(-1).content, /Uploaded training source/);
  assert.deepEqual(calls[1].body.messages.slice(1, 3), input.history);
  assert.equal(calls[1].body.messages[0].content, input.system);
  assert.equal(calls[0].body.contents[0].parts[0].text, input.history[0].content);
  assert.equal(calls[0].body.systemInstruction.parts[0].text, input.system);
});

test("auth errors, malformed responses and empty answers advance to OpenAI", async () => {
  for (const failure of [() => new Response("", { status: 401 }), () => new Response("invalid JSON"), () => Response.json({}), () => Response.json({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "partial" }] } }] })]) {
    let count = 0;
    const generate = createAnswerGenerator({ env, fetch: async () => ++count <= 2 ? failure() : openaiAnswer() });
    assert.deepEqual(await generate(input), { answer: "Complete notice", provider: "openai" });
  }
});

test("upstream network failure advances without repeated retries", async () => {
  let count = 0;
  const generate = createAnswerGenerator({ env, fetch: async () => { if (++count === 1) throw new TypeError("connection closed"); return openaiAnswer(); } });
  assert.equal((await generate(input)).provider, "nvidia");
  assert.equal(count, 2);
});

test("DeepSeek uses NVIDIA's thinking option while Nemotron keeps enable_thinking", async () => {
  for (const [model, expected] of [
    ["deepseek-ai/deepseek-v4-pro-0813", { thinking: false }],
    ["nvidia/nemotron-3.5-lightning-30b-a3b", { enable_thinking: false }]
  ] as const) {
    const generate = createAnswerGenerator({
      env: { NVIDIA_API_KEY: "test-nvidia", WOOHYUKMON_NVIDIA_MODEL: model },
      fetch: async (_, init) => {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.model, model);
        assert.deepEqual(body.chat_template_kwargs, expected);
        return openaiAnswer();
      }
    });
    assert.equal((await generate(input)).provider, "nvidia");
  }
});

test("provider deadline aborts stalled request and moves to the next provider", async () => {
  // Keep the event loop alive while AbortSignal.timeout uses an unref'd timer.
  const keepAlive = setInterval(() => {}, 100);
  let count = 0;
  const generate = createAnswerGenerator({ env, timeoutMs: 15, fetch: async (_, init) => {
    if (++count > 1) return openaiAnswer();
    return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true }));
  } });
  try { assert.equal((await generate(input)).provider, "nvidia"); }
  finally { clearInterval(keepAlive); }
});

test("cooldown honors Retry-After and recovers; Gemini RPM protection also falls back", async () => {
  let time = 0;
  let geminiCalls = 0;
  const generate = createAnswerGenerator({ env: { ...env, GEMINI_RPM_LIMIT: "1" }, now: () => time, fetch: async (url) => {
    if (!String(url).includes("googleapis")) return openaiAnswer();
    return ++geminiCalls === 1 ? new Response("", { status: 429, headers: { "Retry-After": "120" } }) : geminiAnswer();
  } });
  await generate(input);
  time = 80_000;
  assert.equal((await generate(input)).provider, "nvidia");
  assert.equal(geminiCalls, 1);
  time = 121_000;
  assert.equal((await generate(input)).provider, "gemini");
  assert.equal((await generate(input)).provider, "nvidia");
});

test("user cancellation stops the chain instead of invoking another provider", async () => {
  const cancellation = new AbortController();
  let calls = 0;
  const generate = createAnswerGenerator({ env, fetch: async () => {
    calls++;
    cancellation.abort();
    throw new Error("aborted");
  } });
  await assert.rejects(generate({ ...input, signal: cancellation.signal }));
  assert.equal(calls, 1);
});

test("a safety block is returned without bypassing it through another model", async () => {
  let calls = 0;
  const generate = createAnswerGenerator({ env, fetch: async () => { calls++; return Response.json({ candidates: [{ finishReason: "SAFETY" }] }); } });
  assert.match((await generate(input)).answer, /cannot answer/);
  assert.equal(calls, 1);
});

test("missing Gemini still permits configured fallback; redacted keys are not credentials", async () => {
  assert.equal(hasGenerationProvider({ GEMINI_API_KEY: "[REDACTED]" }), false);
  const generate = createAnswerGenerator({ env: { OPENAI_API_KEY: "test" }, fetch: async () => openaiAnswer() });
  assert.equal((await generate(input)).provider, "openai");
  const unavailable = createAnswerGenerator({ env, fetch: async () => new Response("", { status: 503 }) });
  await assert.rejects(unavailable(input), /All configured/);
});

test("history retains long exchanges, rejects injected system roles and stays bounded", () => {
  const history = Array.from({ length: 30 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `${index}: ${"x".repeat(1600)}` }));
  const cleaned = conversationHistory([{ role: "system", content: "Injected" }, ...history]);
  assert.equal(cleaned.length, 30);
  assert.equal(cleaned[0].content, history[0].content);
  assert.ok(conversationHistory(Array.from({ length: 80 }, () => ({ role: "user", content: "x".repeat(20000) }))).reduce((sum, message) => sum + message.content.length, 0) <= 60_000);
  assert.equal(conversationHistory(Array.from({ length: 80 }, () => ({ role: "user", content: "hello" }))).length, 48);
});
