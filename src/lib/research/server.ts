import "server-only";

import { getHanhwalRoleRow } from "@/lib/hanhwalAccess";
import { canEditResearchItem, type ResearchAccess } from "./access";

import { auth } from "@/auth";
import { getAdminAccess, normalizeEmail } from "@/lib/admin";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";
import { isPublicResearch, toPublicResearchItem, type ResearchItem } from "./model";

const table = "kline_research_items";
const columns = "id,title_ko,title_en,subtitle_ko,subtitle_en,summary_ko,summary_en,body_ko,body_en,category,topic,tags,cover_path,image_paths,attachment_paths,author_name,author_organization,related_organization_id,related_activity_id,quotes,reference_entries,status,visibility,is_sample,created_by,published_at,updated_at";

type ResearchRow = Record<string, unknown> & { id: string };

export class ResearchInputError extends Error {}

export function isResearchId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function toResearchItem(row: ResearchRow): ResearchItem {
  const read = (key: string) => typeof row[key] === "string" ? row[key] as string : "";
  const list = (key: string) => Array.isArray(row[key]) ? (row[key] as unknown[]).filter((value): value is string => typeof value === "string") : [];
  return {
    id: row.id,
    titleKo: read("title_ko"), titleEn: read("title_en"),
    subtitleKo: read("subtitle_ko"), subtitleEn: read("subtitle_en"),
    summaryKo: read("summary_ko"), summaryEn: read("summary_en"),
    bodyKo: read("body_ko"), bodyEn: read("body_en"),
    category: read("category"), topic: read("topic"), tags: list("tags"),
    coverPath: read("cover_path"), imagePaths: list("image_paths"),
    attachmentPaths: list("attachment_paths"), authorName: read("author_name"),
    authorOrganization: read("author_organization"), relatedOrganizationId: read("related_organization_id"),
    relatedActivityId: read("related_activity_id"), quotes: list("quotes"), references: list("reference_entries"),
    status: row.status === "published" || row.status === "archived" ? row.status : "draft",
    visibility: row.visibility === "public" || row.visibility === "members" ? row.visibility : "private",
    isSample: row.is_sample === true, createdBy: read("created_by"),
    publishedAt: read("published_at"), updatedAt: read("updated_at")
  };
}

export async function getResearchEditorAccess(): Promise<ResearchAccess> {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email) return { email: "", canEdit: false, canManageAll: false };
  const admin = await getAdminAccess(email);
  if (admin.isReadOnly) return { email, canEdit: false, canManageAll: false };
  if (admin.isSuperAdmin || admin.isDeveloper) return { email, canEdit: true, canManageAll: true, canManageEditors: true };
  const editors = await supabaseRequest<Array<{ email: string }>>(
    `kline_research_editors?select=email&email=eq.${encodeURIComponent(email)}&limit=1`
  );
  if (editors.length > 0) return { email, canEdit: true, canManageAll: true };
  const member = await getHanhwalRoleRow(email);
  const canEdit = member?.official_member_status === "approved" || member?.admin_status === "approved" || member?.super_admin_status === "approved";
  return { email, canEdit, canManageAll: false };
}

export async function listResearchItems(manage = false, editor?: ResearchAccess) {
  if (manage && !editor?.canEdit) return [];
  const filter = manage ? (editor?.canManageAll ? "" : `&created_by=eq.${encodeURIComponent(editor!.email)}`) : "&status=eq.published&visibility=eq.public&is_sample=eq.false";
  const rows = await supabaseRequest<ResearchRow[]>(
    `${table}?select=${columns}${filter}&order=published_at.desc.nullslast,updated_at.desc&limit=1000`,
    { cache: "no-store" }
  );
  return rows.map(toResearchItem).filter((item) => manage || isPublicResearch(item))
    .map((item) => manage ? item : toPublicResearchItem(item));
}

export async function getResearchItem(id: string) {
  const rows = await supabaseRequest<ResearchRow[]>(
    `${table}?select=${columns}&id=eq.${encodeURIComponent(id)}&limit=1`,
    { cache: "no-store" }
  );
  return rows[0] ? toResearchItem(rows[0]) : null;
}

function cleanList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

export function cleanResearchInput(value: Record<string, unknown>, hasVerifiedAttachment = false) {
  const status = value.status === "published" || value.status === "archived" ? value.status : "draft";
  const visibility = value.visibility === "public" || value.visibility === "members" ? value.visibility : "private";
  const titleKo = cleanText(value.titleKo, 240);
  const titleEn = cleanText(value.titleEn, 240);
  const bodyKo = cleanText(value.bodyKo, 100000);
  const bodyEn = cleanText(value.bodyEn, 100000);
  const summaryKo = cleanText(value.summaryKo, 1500) || cleanText(bodyKo.slice(0, 300), 1500);
  const summaryEn = cleanText(value.summaryEn, 1500) || cleanText(bodyEn.slice(0, 300), 1500);
  const authorName = cleanText(value.authorName, 160);
  const authorOrganization = cleanText(value.authorOrganization, 160);
  if (!titleKo && !titleEn) throw new ResearchInputError("A Korean or English title is required.");
  const fileOnly = !bodyKo && !bodyEn && hasVerifiedAttachment;
  if (status === "published" && !bodyKo && !bodyEn && !fileOnly) throw new ResearchInputError("Add a body or upload a document before publishing.");
  if (status === "published" && visibility !== "public") throw new ResearchInputError("Publish only public research; keep other visibility levels as drafts.");
  return {
    title_ko: titleKo, title_en: titleEn,
    subtitle_ko: cleanText(value.subtitleKo, 240), subtitle_en: cleanText(value.subtitleEn, 240),
    summary_ko: summaryKo, summary_en: summaryEn,
    body_ko: bodyKo, body_en: bodyEn,
    category: cleanText(value.category, 100) || "Research Note",
    topic: cleanText(value.topic, 120), tags: cleanList(value.tags, 20, 80),
    author_name: authorName, author_organization: authorOrganization,
    related_organization_id: cleanText(value.relatedOrganizationId, 160),
    related_activity_id: cleanText(value.relatedActivityId, 160),
    quotes: cleanList(value.quotes, 20, 2000), reference_entries: cleanList(value.references, 30, 1000),
    status, visibility
  };
}

export async function insertResearchItem(payload: ReturnType<typeof cleanResearchInput>, email: string) {
  const rows = await supabaseRequest<ResearchRow[]>(`${table}?select=${columns}`, {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...payload, created_by: email })
  });
  return toResearchItem(rows[0]);
}

export async function updateResearchItem(id: string, payload: Record<string, unknown>) {
  const rows = await supabaseRequest<ResearchRow[]>(`${table}?id=eq.${encodeURIComponent(id)}&select=${columns}`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() })
  });
  return rows[0] ? toResearchItem(rows[0]) : null;
}

export async function deleteResearchItem(id: string) {
  await supabaseRequest(`${table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export { canEditResearchItem };
