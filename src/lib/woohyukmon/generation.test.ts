import assert from "node:assert/strict";
import { test } from "node:test";
import { createAnswerGenerator, hasGenerationProvider } from "./generation";
import { conversationHistory } from "./conversation";

const env = { GEMINI_API_KEY: "test-gemini", NVIDIA_API_KEY: "test-nvidia", EVENT_AI_OPENAI_API_KEY: "test-event-openai", OPENAI_API_KEY: "test-legacy-openai" };
const input = { system: "Keep the ECC notice style.", history: [{ role: "user" as const, content: "Autumn notice" }, { role: "assistant" as const, content: "Preparing it" }], message: "Write the notice.", context: "Verified ECC autumn notice." };
const answer = (text = "Complete notice") => Response.json({ status: "completed", model: "gpt-6-luna", output: [{ content: [{ type: "output_text", text }] }] });

test("all chat uses OpenAI Responses, event-scoped key, preserved history and actual model metadata", async () => {
  let calls = 0;
  const generate = createAnswerGenerator({ env, fetch: async (url, init) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(init?.headers && (init.headers as Record<string,string>).Authorization, "Bearer test-event-openai");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "gpt-6-luna");
    assert.equal(body.store, false);
    assert.equal(body.instructions, input.system);
    assert.deepEqual(body.input.slice(0, 2), input.history);
    assert.match(body.input.at(-1).content, /Verified ECC/);
    assert.equal(body.temperature, undefined);
    assert.equal(body.max_tokens, undefined);
    assert.equal(init?.redirect, "error");
    return answer();
  } });
  assert.deepEqual(await generate(input), { answer: "Complete notice", provider: "openai", model: "gpt-6-luna" });
  assert.equal(calls, 1);
});

test("legacy provider order cannot route general chat to Gemini or NVIDIA", async () => {
  const generate = createAnswerGenerator({ env: { ...env, WOOHYUKMON_PROVIDER_ORDER: "gemini,nvidia" }, fetch: async url => { assert.match(String(url), /^https:\/\/api.openai.com\//); return answer(); } });
  assert.equal((await generate(input)).provider, "openai");
  assert.equal(hasGenerationProvider({ GEMINI_API_KEY: "test", NVIDIA_API_KEY: "test" }), false);
});

test("401, missing scopes, rate errors and unavailable models fail closed with no hidden fallback", async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    let calls = 0;
    const generate = createAnswerGenerator({ env, fetch: async () => { calls++; return new Response("", { status }); } });
    await assert.rejects(generate(input), /OpenAI/);
    assert.equal(calls, 1);
  }
});

test("malformed and incomplete answers are not reported as completion", async () => {
  for (const response of [() => Response.json({}), () => Response.json({ status: "incomplete", output: [{ content: [{ type: "output_text", text: "partial" }] }] }), () => new Response("invalid JSON")]) {
    const generate = createAnswerGenerator({ env, fetch: async () => response() });
    await assert.rejects(generate(input));
  }
});

test("refusals are never routed around to a different model", async () => {
  let calls = 0;
  const generate = createAnswerGenerator({ env, fetch: async () => { calls++; return Response.json({ model: "gpt-6-luna", output: [{ content: [{ type: "refusal" }] }] }); } });
  assert.match((await generate(input)).answer, /cannot answer/);
  assert.equal(calls, 1);
});

test("caller abort and provider deadline stop the request", async () => {
  const controller = new AbortController(); controller.abort();
  const generate = createAnswerGenerator({ env, fetch: async () => { throw Error("Must not call"); } });
  await assert.rejects(generate({ ...input, signal: controller.signal }));
  const keepAlive = setInterval(() => {}, 100);
  try {
    const stalled = createAnswerGenerator({ env, timeoutMs: 10, fetch: async (_, init) => new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))) });
    await assert.rejects(stalled(input));
  } finally { clearInterval(keepAlive); }
});

test("structured action planning uses strict schema and allows explicit OpenAI model config", async () => {
  const schema = { type: "object", additionalProperties: false, properties: { answer: { type: "string" } }, required: ["answer"] };
  const generate = createAnswerGenerator({ env: { ...env, WOOHYUKMON_OPENAI_MODEL: "gpt-6.1-sol", WOOHYUKMON_OPENAI_API_KEY: "dedicated" }, fetch: async (_, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "gpt-6.1-sol"); assert.equal(body.text.format.strict, true); assert.deepEqual(body.text.format.schema, schema);
    return Response.json({ status: "completed", model: "gpt-6.1-sol", output: [{ content: [{ type: "output_text", text: '{"answer":"ok"}' }] }] });
  } });
  assert.equal((await generate({ ...input, outputSchema: schema })).model, "gpt-6.1-sol");
});

test("redacted or missing OpenAI credentials are never used", async () => {
  for (const key of ["", "[Sensitive]", "masked", "[REDACTED]"]) assert.equal(hasGenerationProvider({ OPENAI_API_KEY: key }), false);
  assert.equal(hasGenerationProvider({ EVENT_AI_OPENAI_API_KEY: "event-key" }), true);
});

test("history retains long exchanges, rejects injected system roles and stays bounded", () => {
  const history = Array.from({ length: 30 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `${index}: ${"x".repeat(1600)}` }));
  const cleaned = conversationHistory([{ role: "system", content: "Injected" }, ...history]);
  assert.equal(cleaned.length, 30);
  assert.equal(cleaned[0].content, history[0].content);
  assert.ok(conversationHistory(Array.from({ length: 80 }, () => ({ role: "user", content: "x".repeat(20000) }))).reduce((sum, message) => sum + message.content.length, 0) <= 60_000);
  assert.equal(conversationHistory(Array.from({ length: 80 }, () => ({ role: "user", content: "hello" }))).length, 48);
});
