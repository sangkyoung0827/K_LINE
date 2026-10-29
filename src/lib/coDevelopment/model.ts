export const labOwner = "waterfallingsound0827@gmail.com";
export const labCollaborator = "noritakeyuki@fuji.waseda.jp";
export const labAccounts = [labOwner, labCollaborator] as const;
export const labApiPath = "/api/co-development";

export function canUseCoDevelopment(email?: string | null) {
  return Boolean(email && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
}

export function isLabOwner(email?: string | null) { return email?.trim().toLowerCase() === labOwner; }
export type LabReview = { id: string; project_id: string; revision_id: string; revision: number; title: string; description: string; state: "pending" | "approved" | "rejected"; requested_by: string; requested_at: string; note: string; current_revision: number; publication_version: number; active: boolean | null; published_revision_id: string | null };
export type LabReviewDetail = { review: LabReview; revision: LabRevision; source: { files: Record<string, string>; sourceHash: string } | null; previousHtml: string | null };
export type LabOwnerProject = Omit<LabProject,"html"|"fixture">;
export type LabOwnerDetail = { project: LabOwnerProject; revisions: Omit<LabRevision,"html"|"fixture">[]; revision: LabRevision; source: LabReviewDetail["source"] };
export type PublishedLab = { id: string; title: string; description: string; revision: number };

export function isCoDevelopmentApi(path: string) {
  return path === labApiPath || path.startsWith(`${labApiPath}/`);
}

export class LabError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

export type LabProject = {
  id: string; title: string; description: string; revision: number;
  html: string; fixture: Record<string, unknown>; review_state: "draft" | "review_requested";
  created_by: string; updated_by: string; created_at: string; updated_at: string;
};
export type LabRevision = {
  id: string; project_id: string; revision: number; title: string; description: string;
  html: string; fixture: Record<string, unknown>; created_by: string; created_at: string;
};
export type LabState = { data: Record<string, unknown>; version: number };
export type LabSave = { id: string; expectedRevision: number; title: string; description: string; html: string; fixture: Record<string, unknown> };
export type LabAppearance = {
  title: string; description: string; cardHtml: string;
  background: string; foreground: string; accent: string; landingProjectId: string | null;
};
export type LabSettings = { appearance: LabAppearance; version: number };
export type LabRecord = { project_id: string; collection: string; id: string; data: Record<string, unknown>; version: number; archived: boolean; updated_by: string; updated_at: string };
export type LabRecords = { records: LabRecord[]; nextCursor: string | null };

export function labCollection(value: unknown) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_-]{0,39}$/.test(value)) throw new LabError("INVALID_COLLECTION");
  return value;
}

export function labSources(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LabError("INVALID_SOURCES");
  const entries = Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  if (!entries.length || entries.length > 100) throw new LabError("INVALID_SOURCES");
  for (const [path, content] of entries) {
    const safeDotfile = path === ".gitignore";
    if (path.length > 160 || (!safeDotfile && (!/^[a-zA-Z0-9_][a-zA-Z0-9_./-]*$/.test(path) || path.split("/").some(part => !part || part.startsWith(".")))) || /(^|\/)(node_modules|private|secrets|credentials)(\/|\.|$)/i.test(path) || /\.(pem|key|p12|pfx)$/i.test(path) || typeof content !== "string" || content.includes("\0") || /\bkll_[a-f0-9]{64}\b/.test(content)) throw new LabError("INVALID_SOURCES");
  }
  const result = Object.fromEntries(entries);
  labNoSecrets(JSON.stringify(result));
  if (new TextEncoder().encode(JSON.stringify(result)).length > 1048576) throw new LabError("SOURCES_TOO_LARGE", 413);
  return result;
}

export function labNoSecrets(value: string) {
  if (/\bkll_[a-f0-9]{64}\b|\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)) throw new LabError("SOURCE_CONTAINS_CREDENTIAL");
}

export function labRecordData(value: unknown) {
  const data = labData(value);
  if (new TextEncoder().encode(JSON.stringify(data)).length > 16384) throw new LabError("DATA_TOO_LARGE", 413);
  return data;
}
export const defaultLabAppearance: LabAppearance = {
  title: "Developer Studio", description: "", cardHtml: "", background: "#F4EBDD", foreground: "#1F2A44", accent: "#D6A85A", landingProjectId: null
};

export function labAppearance(value: unknown): LabAppearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LabError("INVALID_APPEARANCE");
  const input = value as Record<string, unknown>;
  const keys = Object.keys(defaultLabAppearance);
  if (Object.keys(input).some(key => !keys.includes(key))) throw new LabError("INVALID_APPEARANCE");
  if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 120) throw new LabError("TITLE_REQUIRED");
  if (typeof input.description !== "string" || input.description.length > 500 || typeof input.cardHtml !== "string") throw new LabError("INVALID_APPEARANCE");
  if (new TextEncoder().encode(input.cardHtml).length > 65536) throw new LabError("CARD_TOO_LARGE", 413);
  for (const key of ["background", "foreground", "accent"]) if (typeof input[key] !== "string" || !/^#[a-f0-9]{6}$/i.test(input[key] as string)) throw new LabError("INVALID_APPEARANCE");
  return { title: input.title.trim(), description: input.description.trim(), cardHtml: input.cardHtml,
    background: input.background as string, foreground: input.foreground as string, accent: input.accent as string,
    landingProjectId: input.landingProjectId === null ? null : labId(input.landingProjectId) };
}

export function labId(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new LabError("INVALID_ID");
  return value;
}

export function labVersion(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new LabError("INVALID_VERSION");
  return value as number;
}

export function labData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LabError("DATA_MUST_BE_OBJECT");
  if (new TextEncoder().encode(JSON.stringify(value)).length > 65536) throw new LabError("DATA_TOO_LARGE", 413);
  return value as Record<string, unknown>;
}

export function labSave(value: Record<string, unknown>, id: string): LabSave {
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 120) throw new LabError("TITLE_REQUIRED");
  if (typeof value.description !== "string" || value.description.length > 2000) throw new LabError("INVALID_DESCRIPTION");
  if (typeof value.html !== "string" || !value.html.trim()) throw new LabError("HTML_REQUIRED");
  if (new TextEncoder().encode(value.html).length > 262144) throw new LabError("HTML_TOO_LARGE", 413);
  labNoSecrets(JSON.stringify({ html: value.html, fixture: value.fixture }));
  return { id: labId(value.id ?? id), expectedRevision: labVersion(value.expectedRevision), title: value.title.trim(), description: value.description.trim(), html: value.html, fixture: labData(value.fixture) };
}

export const labPreviewCsp = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts";

// The module only receives revision state and project-scoped test records through a MessagePort.
// No account, cookie, API key, production data or arbitrary fetch bridge is exposed.
export function labPreviewHtml(html: string) {
  const sdk = `(function(){let port;const pending=new Map();let n=0;
    const connected=new Promise(resolve=>{addEventListener('message',function init(e){if(e.source!==parent||e.data?.type!=='kline-lab-connect'||!e.ports[0])return;removeEventListener('message',init);port=e.ports[0];port.onmessage=event=>{const p=pending.get(event.data?.id);if(!p)return;pending.delete(event.data.id);clearTimeout(p.timer);event.data.error?p.reject(new Error(event.data.error)):p.resolve(event.data.result);};port.start();resolve();});parent.postMessage({type:'kline-lab-ready'},'*');});
    async function call(action,payload){await connected;return new Promise((resolve,reject)=>{const id=++n;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('LAB_TIMEOUT'));},15000);pending.set(id,{resolve,reject,timer});port.postMessage({...payload,id,action});});}
    window.KLINE_LAB=Object.freeze({read:()=>call('read',{}),save:(data,expectedVersion)=>call('save',{data,expectedVersion}),records:Object.freeze({list:(collection,options={})=>call('records_list',{collection,...options}),create:(collection,data)=>call('record_create',{collection,data}),save:(collection,id,data,expectedVersion,archived=false)=>call('record_save',{collection,recordId:id,data,expectedVersion,archived})})});})();`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>${sdk}</script></head><body>${html}</body></html>`;
}
