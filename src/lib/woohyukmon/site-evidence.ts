import "server-only";
import { publicActivities } from "@/data/activities";
import type { ClubAssistantAccess, AssistantScope } from "./club-access";
import { normalizeNationality } from "./operations/nationality";

type Row = Record<string, unknown>;
type Reader = { id: string; path: string; collection: string; load: () => Promise<Record<string, unknown>>; scope?: AssistantScope; query?: Record<string, string>; cap?: number; aggregate?: boolean; search?: boolean; single?: boolean };
type Handler = (request: Request) => Promise<Response>;

// Only existing, fixed GET handlers. Model text can never become a URL or SQL.
const readers: Reader[] = [
  { id: "ecc_catalog", path: "/api/ecc/activity-catalog", collection: "activities", load: () => import("@/app/api/ecc/activity-catalog/route") },
  { id: "ecc_library", path: "/api/ecc/resources", collection: "resources", cap: 300, load: () => import("@/app/api/ecc/resources/route") },
  { id: "ecc_posts", path: "/api/club-board-posts", collection: "posts", query: { board: "ecc" }, cap: 120, load: () => import("@/app/api/club-board-posts/route") },
  { id: "hanhwal_introduction", path: "/api/hanhwal/introduction", collection: "content", single: true, load: () => import("@/app/api/hanhwal/introduction/route") },
  { id: "public_research", path: "/api/research", collection: "items", cap: 1000, load: () => import("@/app/api/research/route") },
  { id: "siu_public_events", path: "/api/siu/activities", collection: "activities", load: () => import("@/app/api/siu/activities/route") },
  { id: "ecc_applications", scope: "ecc", path: "/api/ecc/applications", collection: "applications", aggregate: true, load: () => import("@/app/api/ecc/applications/route") },
  { id: "hanhwal_applications", scope: "hanhwal", path: "/api/hanhwal/applications", collection: "applications", aggregate: true, load: () => import("@/app/api/hanhwal/applications/route") },
  { id: "hanhwal_rounds", scope: "hanhwal", path: "/api/hanhwal/structured-activities", collection: "activities", load: () => import("@/app/api/hanhwal/structured-activities/route") },
  { id: "hanhwal_posts", scope: "hanhwal", path: "/api/hanhwal/posts", collection: "posts", cap: 120, load: () => import("@/app/api/hanhwal/posts/route") },
  { id: "siu_managed_events", scope: "social_impact_union", path: "/api/siu/activities", query: { mode: "admin" }, collection: "activities", load: () => import("@/app/api/siu/activities/route") },
  { id: "jeju_programs", scope: "jeju", path: "/api/jeju/programs", collection: "programs", load: () => import("@/app/api/jeju/programs/route") },
  { id: "uploaded_knowledge", scope: "event_archive", path: "/api/woohyukmon/knowledge/search", collection: "results", search: true, cap: 8, load: () => import("@/app/api/woohyukmon/knowledge/search/route") }
];

export function needsSiteEvidence(message: string) {
  return /k[_\s-]?line|케이라인|활동|행사|프로그램|자료|공지|activity|event|program|library|research/i.test(message)
    && /추천|선호|좋아|인기|비교|기반|검색|찾아|찾아줘|조회|recommend|prefer|popular|compar|search|find|based\s+on/i.test(message);
}

const text = (value: unknown, limit = 600) => typeof value === "string" ? value.slice(0, limit) : "";
const redact = (value: string) => value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email omitted]").replace(/(?:\+?82[-. ]?)?0?1[016789][-. ]?\d{3,4}[-. ]?\d{4}/g, "[phone omitted]").replace(/\b(?:sk-(?:proj-)?|sb_secret_|GOCSPX-)[A-Za-z0-9_./+-]{12,}\b/g, "[secret omitted]").replace(/https?:\/\/open\.kakao\.com\/\S+/gi, "[chat link omitted]");
const recordFields = ["id", "fileName", "title", "titleKo", "titleEn", "category", "topic", "tags", "categories", "authorName", "authorOrganization", "organization", "event", "pageNumber", "starts_at", "ends_at", "eventDate", "publishedAt", "createdAt", "status", "location_name", "location", "capacity", "application_count", "description", "descriptionKo", "descriptionEn", "short_description", "summaryKo", "summaryEn", "content", "bodyKo", "bodyEn"];

function record(row: Row, reader: Reader) {
  const projected: Row = {};
  let textBudget = 650;
  for (const key of recordFields) {
    const value = row[key];
    if (typeof value === "string" && textBudget > 0) { const excerpt = redact(value).slice(0, Math.min(textBudget, 350)); projected[key] = excerpt; textBudget -= excerpt.length; }
    else if (typeof value === "number" || typeof value === "boolean") projected[key] = value;
    else if (Array.isArray(value) && value.every(item => typeof item === "string")) projected[key] = value.slice(0, 6).map(item => redact(text(item, 40)));
  }
  // No uploaded files, signed URLs, chat links, raw answer payloads or admin notes.
  const id = text(row.id, 120);
  const href = reader.id === "uploaded_knowledge" ? "/developer/woohyukmon-training"
    : reader.id === "public_research" ? `/open-k-culture-research/${encodeURIComponent(id)}`
    : reader.id === "ecc_library" ? `/our-activities/ecc/resources/${encodeURIComponent(id)}`
    : reader.id.startsWith("siu_") ? `/social-impact-union/activities/${encodeURIComponent(id)}`
    : reader.id.startsWith("hanhwal_") ? "/our-activities/hanhwal" : "/our-activities/ecc/activity";
  return { ...projected, href: reader.id === "ecc_posts" ? `/our-activities/ecc/${encodeURIComponent(id)}` : href };
}

export function applicationEvidence(rows: Row[]) {
  const groups = new Map<string, { activityId: string; title: string; returnedApplications: number; foreignApplications: number; koreanApplications: number; unknownNationality: number }>();
  for (const row of rows) {
    if (["cancelled", "canceled", "rejected"].includes(String(row.status))) continue;
    const id = text(row.type || row.activityId || row.activity_id, 120) || "unknown";
    const group = groups.get(id) || { activityId: id, title: redact(text(row.activityTitle || row.activity_title || id, 180)), returnedApplications: 0, foreignApplications: 0, koreanApplications: 0, unknownNationality: 0 };
    group.returnedApplications++;
    const nationality = normalizeNationality(text(row.nationality, 100));
    if (/^(Unknown|Other|Prefer not to say|N\/A|없음|비공개|기타|-|\?)$/i.test(nationality)) group.unknownNationality++;
    else if (nationality === "South Korea") group.koreanApplications++;
    else group.foreignApplications++;
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => b.foreignApplications - a.foreignApplications || b.returnedApplications - a.returnedApplications);
}

export async function loadSiteEvidence(access: ClubAssistantAccess, request: Request, query: string) {
  const sources: Row[] = [];
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);
  for (const reader of readers) {
    if (reader.scope && (!access.email || !access.scopes.includes(reader.scope))) {
      sources.push({ source: reader.id, status: "not_authorized" }); continue;
    }
    const rows: Row[] = [];
    let offset = 0, partial = false, failure = "";
    try {
      signal.throwIfAborted();
      const handler = (await reader.load())[reader.search ? "POST" : "GET"] as Handler;
      for (let page = 0; page < 8; page++) {
        signal.throwIfAborted();
        const url = new URL(reader.path, request.url);
        for (const [key, value] of Object.entries(reader.query || {})) url.searchParams.set(key, value);
        url.searchParams.set("offset", String(offset));
        const headers = new Headers(request.headers);
        headers.set("Origin", url.origin);
        if (reader.search) headers.set("Content-Type", "application/json");
        const response = await boundedRead(handler(new Request(url, { headers, signal, ...(reader.search ? { method: "POST", body: JSON.stringify({ query: query.slice(0, 1000), limit: 8 }) } : {}) })), signal);
        if (!response.ok) { failure = [401, 403].includes(response.status) ? "not_authorized" : "unavailable"; break; }
        const data = await response.json();
        const batch = reader.single ? (data[reader.collection] === null ? [] : [data[reader.collection]]) : data[reader.collection];
        if (!Array.isArray(batch) || batch.some(row => !row || typeof row !== "object" || Array.isArray(row))) throw Error("INVALID_SOURCE");
        rows.push(...batch);
        if (data.nextOffset === null || data.nextOffset === undefined) { partial = Boolean(reader.cap && rows.length >= reader.cap); break; }
        if (!Number.isInteger(data.nextOffset) || data.nextOffset <= offset) throw Error("INVALID_PAGINATION");
        offset = data.nextOffset;
        partial = page === 7;
      }
    } catch { if (request.signal.aborted) throw new Error("SOURCE_ABORTED"); failure = "unavailable"; }
    if (failure) { sources.push({ source: reader.id, ...(failure === "not_authorized" ? {} : { path: reader.path }), status: failure }); continue; }
    const visible = reader.id === "ecc_catalog" ? rows.filter(row => !row.archived)
      : reader.id === "public_research" ? rows.filter(row => row.status === "published" && row.visibility === "public" && !row.isSample)
      : reader.id === "siu_public_events" ? rows.filter(row => row.status === "published") : rows;
    const isSnapshot = reader.aggregate || Boolean(reader.cap);
    const statistics = reader.aggregate ? applicationEvidence(visible) : [];
    sources.push({ source: reader.id, path: reader.path, status: partial ? "partial" : visible.length ? "ready" : "empty", coverage: isSnapshot ? "returned rows only; API may cap results; not lifetime history" : "existing listing API", returnedRows: visible.length,
      ...(reader.aggregate ? { completeServerTotals: statistics.reduce((total, group) => ({ returnedApplications: total.returnedApplications + group.returnedApplications, foreignApplications: total.foreignApplications + group.foreignApplications, koreanApplications: total.koreanApplications + group.koreanApplications, unknownNationality: total.unknownNationality + group.unknownNationality }), { returnedApplications: 0, foreignApplications: 0, koreanApplications: 0, unknownNationality: 0 }), applicationStatistics: statistics.slice(0, 80), activityGroups: statistics.length, displayedGroups: Math.min(statistics.length, 80) } : { records: rankRecords(visible.map(row => record(row, reader)), query).slice(0, 8), displayedRecords: Math.min(visible.length, 8) }),
      ...(reader.id === "siu_public_events" ? { limitation: "Public listing shows upcoming published events with an open deadline, not all previous SIU events." } : {}),
      ...(reader.search ? { limitation: "Returned search matches only. No matches does not establish absence; the legacy retriever can return an empty list when a search backend fails." } : {}) });
  }
  return {
    asOf: new Date().toISOString(), sources: sources.sort((a, b) => Number(Boolean(b.applicationStatistics)) - Number(Boolean(a.applicationStatistics))),
    publishedSiteReferences: rankRecords(publicActivities.map(item => ({ title: item.title, description: item.content, tags: item.tags, href: `/our-activities/${item.slug}`, evidenceType: "site reference, NOT verified attendance or preference" })), query),
    limitations: ["Application counts measure returned registrations, NOT unique participants, verified attendance, satisfaction or a preference survey. Use completeServerTotals for all-activity totals, and applicationStatistics for a specific activity. Never substitute one activity's count for the total.", "Foreign nationality counts come from self-reported nationality; missing/unknown values are separate.", "No personal memory books, individual preference profiles, raw Google Form answers, private files or member contact data are included.", "A failed or unauthorized source is NOT evidence that the club has no records.", "Recommend useful proposed programs from available evidence; distinguish observed signals from hypotheses, cite source paths and scope. Never claim all foreigners prefer one event."]
  };
}

async function boundedRead<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort: (() => void) | undefined;
  try {
    signal.throwIfAborted();
    return await Promise.race([task, new Promise<never>((_, reject) => {
      abort = () => reject(new Error("SOURCE_TIMEOUT"));
      signal.addEventListener("abort", abort, { once: true });
    })]);
  } finally { if (abort) signal.removeEventListener("abort", abort); }
}

function rankRecords(rows: Row[], query: string) {
  const terms = [...new Set(query.toLowerCase().split(/[^a-z0-9가-힣]+/).filter(term => term.length > 1))];
  const score = (row: Row) => terms.reduce((sum, term) => sum + (JSON.stringify(row).toLowerCase().includes(term) ? 1 : 0), 0);
  return [...rows].sort((a, b) => score(b) - score(a));
}
