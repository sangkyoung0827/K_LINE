import "server-only";

import OpenAI from "openai";
import type { KnowledgeAnalysis } from "@/lib/knowledge/types";

export type EmbeddingBatch = {
  model: string;
  provider: "gemini" | "openai";
  vectors: number[][];
};

const entityTypes = new Set([
  "PERSON",
  "ORGANIZATION",
  "EVENT",
  "LOCATION",
  "DATE",
  "PROJECT",
  "ROLE",
  "TOPIC"
]);

function clean(value: unknown, length = 1200) {
  return typeof value === "string" ? value.trim().slice(0, length) : "";
}

function clampConfidence(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(number, 0), 1) : 0.5;
}

function parseJsonObject(value: string) {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI analysis did not return JSON.");
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function normalizeAnalysis(value: Record<string, unknown>, fallbackText: string): KnowledgeAnalysis {
  const rawEntities = Array.isArray(value.entities) ? value.entities : [];
  return {
    confidence: clampConfidence(value.confidence),
    description: clean(value.description, 3000) || clean(fallbackText, 1200),
    documentDate: /^\d{4}-\d{2}-\d{2}$/.test(clean(value.documentDate, 10))
      ? clean(value.documentDate, 10)
      : null,
    documentType: clean(value.documentType, 100) || "UNKNOWN",
    entities: rawEntities.slice(0, 50).flatMap((entity) => {
      if (!entity || typeof entity !== "object") return [];
      const input = entity as Record<string, unknown>;
      const type = clean(input.type, 20).toUpperCase();
      const name = clean(input.name, 160);
      if (!name || !entityTypes.has(type)) return [];
      return [{
        confidence: clampConfidence(input.confidence),
        name,
        sourceText: clean(input.sourceText, 500),
        type: type as KnowledgeAnalysis["entities"][number]["type"]
      }];
    }),
    event: clean(value.event, 200) || "UNKNOWN",
    location: clean(value.location, 200) || "UNKNOWN",
    organization: clean(value.organization, 100) || "UNKNOWN",
    summary: clean(value.summary, 1600) || clean(fallbackText, 600)
  };
}

function knowledgeAnalysisPrompt(name: string, text: string) {
  return `Analyze this K_LINE knowledge source. Return one JSON object only with these keys:
summary, description, documentType, organization, event, location, documentDate, confidence, entities.
entities must be an array of {type,name,confidence,sourceText}; type is one of PERSON, ORGANIZATION, EVENT, LOCATION, DATE, PROJECT, ROLE, TOPIC.
Use UNKNOWN when evidence is insufficient. Do not identify or guess people in photographs. Distinguish source facts from inference and stay conservative.
File: ${name}
Source content:
${text.slice(0, 28000)}`;
}

function configuredProvider() {
  if (process.env.OPENAI_API_KEY?.trim()) return "openai" as const;
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini" as const;
  throw new Error("No AI provider is configured for knowledge analysis.");
}

async function analyzeWithOpenAI(input: {
  buffer?: Buffer;
  mimeType?: string;
  name: string;
  text: string;
}) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: knowledgeAnalysisPrompt(input.name, input.text) }
  ];
  if (input.buffer && input.mimeType?.startsWith("image/")) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${input.mimeType};base64,${input.buffer.toString("base64")}`, detail: "low" }
    });
  }
  const response = await client.chat.completions.create({
    model: process.env.WOOHYUKMON_KNOWLEDGE_MODEL?.trim() || "gpt-4o-mini",
    messages: [{ role: "user", content }],
    response_format: { type: "json_object" },
    temperature: 0.1
  });
  return response.choices[0]?.message.content ?? "{}";
}

async function analyzeWithGemini(input: {
  buffer?: Buffer;
  mimeType?: string;
  name: string;
  text: string;
}) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is missing.");
  const model = process.env.WOOHYUKMON_KNOWLEDGE_MODEL?.trim() || "gemini-3.5-flash-lite";
  const parts: Array<Record<string, unknown>> = [{ text: knowledgeAnalysisPrompt(input.name, input.text) }];
  if (input.buffer && input.mimeType?.startsWith("image/")) {
    parts.push({ inlineData: { data: input.buffer.toString("base64"), mimeType: input.mimeType } });
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts, role: "user" }],
        generationConfig: { responseMimeType: "application/json" }
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini analysis failed: ${response.status} ${await response.text()}`);
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "{}";
}

export async function analyzeKnowledgeSource(input: {
  buffer?: Buffer;
  mimeType?: string;
  name: string;
  text: string;
}) {
  if (input.buffer && input.buffer.byteLength > 18 * 1024 * 1024) {
    throw new Error("Image is stored, but it is too large for the current vision analysis request.");
  }
  let provider = configuredProvider();
  let raw: string;
  if (provider === "openai") {
    try {
      raw = await analyzeWithOpenAI(input);
    } catch (error) {
      if (!process.env.GEMINI_API_KEY?.trim()) throw error;
      console.warn("OpenAI knowledge analysis failed; retrying with Gemini.");
      provider = "gemini";
      raw = await analyzeWithGemini(input);
    }
  } else {
    raw = await analyzeWithGemini(input);
  }
  return { analysis: normalizeAnalysis(parseJsonObject(raw), input.text || input.name), provider };
}

async function embedWithOpenAI(texts: string[]): Promise<EmbeddingBatch> {
  const model = process.env.WOOHYUKMON_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.embeddings.create({
    dimensions: 1536,
    input: texts,
    model
  });
  return { model, provider: "openai", vectors: response.data.map((item) => item.embedding) };
}

async function embedWithGemini(texts: string[]): Promise<EmbeddingBatch> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is missing.");
  const model = process.env.WOOHYUKMON_EMBEDDING_MODEL?.trim() || "gemini-embedding-001";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          content: { parts: [{ text }] },
          model: `models/${model}`,
          outputDimensionality: 1536,
          taskType: "RETRIEVAL_DOCUMENT"
        }))
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini embedding failed: ${response.status} ${await response.text()}`);
  const payload = (await response.json()) as { embeddings?: Array<{ values?: number[] }> };
  const vectors = payload.embeddings?.map((embedding) => embedding.values ?? []) ?? [];
  if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== 1536)) {
    throw new Error("Gemini returned an unexpected embedding shape.");
  }
  return { model, provider: "gemini", vectors };
}

export async function embedKnowledgeTexts(texts: string[]) {
  if (texts.length === 0) return { model: "", provider: configuredProvider(), vectors: [] } as EmbeddingBatch;
  if (configuredProvider() === "gemini") return embedWithGemini(texts);
  try {
    return await embedWithOpenAI(texts);
  } catch (error) {
    if (!process.env.GEMINI_API_KEY?.trim()) throw error;
    console.warn("OpenAI knowledge embedding failed; retrying with Gemini.");
    return embedWithGemini(texts);
  }
}

export async function embedKnowledgeQuery(text: string) {
  const result = await embedKnowledgeTexts([text.slice(0, 8000)]);
  return { model: result.model, provider: result.provider, vector: result.vectors[0] };
}
