export type BusinessCollectionRequest = {
  query: string;
};

export type BusinessCollectionSource = {
  provider: string;
  snippet: string;
  title: string;
  url: string;
};

export type BusinessCollectionSummary = {
  approvedRows: number;
  collectedAt: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  discardedRows: number;
  entityCount: number;
  providerCount: number;
  query: string;
  stagedRows: number;
};

export type EphemeralBusinessCollection = {
  context: string;
  summary: BusinessCollectionSummary;
};

const collectionPatterns = [
  /(?:데이터|자료|정보)(?:를|을)?\s*(?:수집|모아|모으|조사)/i,
  /(?:시장|상품|소비자|가격|판매)\s*(?:데이터|자료)(?:를|을)?\s*(?:수집|조사)/i,
  /(?:collect|gather|research|scrape)\s+(?:the\s+)?(?:market\s+)?data/i,
  /data\s+(?:collection|research|gathering)/i
];

const trailingRequestWords = /\s*(?:데이터|자료|정보)?(?:를|을)?\s*(?:수집|모아|모으고|모아서|조사)(?:해|해서|하여|하고|해주세요|해줘|해라|해봐|하라)?\s*[.!?]*$/i;
const reportWords = /\s*(?:그\s*결과로|결과를\s*통해|수집\s*후)?\s*(?:보고서|리포트)(?:를|을)?\s*(?:작성|생성|만들)(?:해줘|해주세요|해|어줘)?\s*[.!?]*$/i;
const stopWords = new Set([
  "가장", "대한", "데이터", "자료", "수집", "정보", "관련", "결과", "보고서", "시장", "통해",
  "그리고", "대한", "있는", "하는", "해줘", "해주세요", "the", "and", "for", "from", "with", "data",
  "market", "report", "research", "collect", "collection", "that", "this", "are", "was", "were"
]);

function compact(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function extractQuery(message: string) {
  const withoutReport = message.replace(reportWords, "");
  const query = withoutReport.replace(trailingRequestWords, "").trim();
  return compact(query || message, 400);
}

export function detectBusinessCollectionRequest(message: string): BusinessCollectionRequest | null {
  const normalized = message.normalize("NFKC").trim();
  if (!normalized || !collectionPatterns.some((pattern) => pattern.test(normalized))) return null;
  return { query: extractQuery(normalized) };
}

function keywordsFromSources(query: string, sources: BusinessCollectionSource[]) {
  const counts = new Map<string, number>();
  const text = [query, ...sources.flatMap((source) => [source.title, source.snippet])].join(" ").toLowerCase();
  const words = text.match(/[가-힣]{2,}|[a-z][a-z0-9-]{2,}/g) ?? [];
  for (const word of words) {
    if (stopWords.has(word) || /^https?$/.test(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12);
}

function priceSignals(sources: BusinessCollectionSource[]) {
  const values: number[] = [];
  for (const source of sources) {
    const matches = `${source.title} ${source.snippet}`.matchAll(/(?:₩\s*|KRW\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,})\s*(?:원|won)?/gi);
    for (const match of matches) {
      const value = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(value) && value >= 100 && value <= 1_000_000_000) values.push(value);
    }
  }
  const unique = [...new Set(values)].sort((left, right) => left - right).slice(0, 40);
  if (!unique.length) return null;
  return {
    count: unique.length,
    maximum: unique[unique.length - 1],
    median: unique[Math.floor(unique.length / 2)],
    minimum: unique[0]
  };
}

export function runEphemeralBusinessDataPipeline(
  request: BusinessCollectionRequest,
  inputSources: BusinessCollectionSource[],
  collectedAt = new Date().toISOString()
): EphemeralBusinessCollection {
  // Staging: normalize and cap the transient workspace. No row is written to a database.
  const staging = inputSources.slice(0, 10_000).map((source) => ({
    provider: compact(source.provider, 100),
    snippet: compact(source.snippet, 900),
    title: compact(source.title, 240),
    url: compact(source.url, 1_500)
  }));

  // Validation and entity resolution: a public HTTP(S) source URL is the entity key.
  const valid = staging.flatMap((row) => {
    const url = safeHttpUrl(row.url);
    if (!url || (!row.title && !row.snippet)) return [];
    return [{ ...row, domain: url.hostname.replace(/^www\./, "").toLowerCase(), url: url.toString() }];
  });
  const resolvedByUrl = new Map<string, (typeof valid)[number]>();
  for (const row of valid) {
    if (!resolvedByUrl.has(row.url)) resolvedByUrl.set(row.url, row);
  }
  const resolved = [...resolvedByUrl.values()];
  const domains = [...new Set(resolved.map((row) => row.domain))];
  const providers = [...new Set(resolved.map((row) => row.provider).filter(Boolean))];
  const confidence = resolved.length >= 8 && domains.length >= 4
    ? "HIGH"
    : resolved.length >= 4 && domains.length >= 2
      ? "MEDIUM"
      : "LOW";
  const keywords = keywordsFromSources(request.query, resolved);
  const prices = priceSignals(resolved);
  const summary: BusinessCollectionSummary = {
    approvedRows: resolved.length,
    collectedAt,
    confidence,
    discardedRows: staging.length - resolved.length,
    entityCount: domains.length,
    providerCount: providers.length,
    query: request.query,
    stagedRows: staging.length
  };

  const evidence = resolved.slice(0, 20).map((row, index) => [
    `Evidence ${index + 1}: ${row.title || row.domain}`,
    `Domain: ${row.domain}`,
    `Provider: ${row.provider || "unknown"}`,
    row.snippet ? `Observation: ${row.snippet}` : "",
    `URL: ${row.url}`
  ].filter(Boolean).join("\n"));

  const context = `WOOHYUKMON 4.0 EPHEMERAL BUSINESS DATA ANALYTICS
This dataset was collected from public web search results for one report only.
Pipeline completed: Staging -> Validation -> Entity Resolution by canonical URL/domain -> automatic approval -> transient Production snapshot -> Data Analytics.
Persistence rule: raw and intermediate rows are not written to K_LINE or Supabase and must be discarded when this request ends. The generated chat report may remain in chat history.
Query: ${request.query}
Collected at: ${collectedAt}
Pipeline counts: staged ${summary.stagedRows}; approved ${summary.approvedRows}; discarded ${summary.discardedRows}; source entities ${summary.entityCount}; providers ${summary.providerCount}.
Evidence confidence: ${summary.confidence}. This measures source coverage, not factual certainty.
Frequent terms: ${keywords.length ? keywords.map(([word, count]) => `${word} (${count})`).join(", ") : "none"}.
Numeric price-like signals: ${prices ? `count ${prices.count}; min ${prices.minimum}; median ${prices.median}; max ${prices.maximum}` : "none detected"}.
Reporting rules:
- Produce a concise Data Analytics report with scope, evidence, findings, limitations, and practical next steps.
- Never claim "most purchased", market share, or sales rank unless the evidence explicitly contains a reliable sales metric.
- Distinguish observed search evidence from verified market statistics.
- Mention the collection time and confidence.
- If evidence is insufficient, say so and recommend the exact additional data needed.

Transient approved evidence:
${evidence.length ? evidence.join("\n\n") : "No valid public evidence was collected."}`;

  // Only the compact prompt context and aggregate summary escape this function. The staging
  // and resolved workspaces become unreachable and are never persisted.
  return { context, summary };
}
