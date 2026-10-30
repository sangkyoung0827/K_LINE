import { countryCodes, docCatalog, schools, writerFields, type GksDegree, type GksForm, type GksStage, type GksTrack } from "./reference";

export type GksDraft = {
  version: 1;
  country: string;
  degree: GksDegree;
  track: GksTrack;
  school: string;
  customUniversity: string;
  department: string;
  documents: Record<string, { stage: GksStage; note: string }>;
  writerLanguage: "ko" | "en";
  writer: Record<GksForm, Record<string, string>>;
};

export function emptyGksDraft(): GksDraft {
  return { version: 1, country: "", degree: "M", track: "University", school: "", customUniversity: "", department: "",
    documents: {}, writerLanguage: "en", writer: { f2: {}, f3: {} } };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function gksText(value: unknown, max = 20000) {
  return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max) : "";
}

export function restoreGksDraft(value: unknown): GksDraft {
  const input = object(value);
  const draft = emptyGksDraft();
  if (input.version !== 1) return draft;
  draft.country = countryCodes.includes(String(input.country)) ? String(input.country) : "";
  draft.degree = input.degree === "D" || input.degree === "R" ? input.degree : "M";
  draft.track = input.track === "Embassy" ? "Embassy" : "University";
  draft.school = input.school === "custom" || schools.some(s => s.id === input.school) ? String(input.school) : "";
  draft.customUniversity = gksText(input.customUniversity, 160);
  draft.department = gksText(input.department, 160);
  draft.writerLanguage = input.writerLanguage === "ko" ? "ko" : "en";
  for (const doc of docCatalog) {
    const saved = object(object(input.documents)[doc.id]);
    draft.documents[doc.id] = { stage: saved.stage === "working" || saved.stage === "ready" ? saved.stage : "todo", note: gksText(saved.note, 5000) };
  }
  for (const form of ["f2", "f3"] as const) {
    const saved = object(object(input.writer)[form]);
    for (const id of ["fullName", ...writerFields[form].map(f => f.id)]) {
      draft.writer[form][id] = gksText(saved[id], id === "fullName" ? 120 : 20000);
    }
  }
  return draft;
}

export function gksCountries() {
  const ko = new Intl.DisplayNames(["ko"], { type: "region" });
  const en = new Intl.DisplayNames(["en"], { type: "region" });
  return countryCodes.map(code => ({ code, ko: ko.of(code) || code, en: en.of(code) || code }));
}

export function findGksCountry(value: string) {
  const input = value.trim().toLowerCase();
  return gksCountries().find(c => c.code.toLowerCase() === input || c.ko.toLowerCase() === input || c.en.toLowerCase() === input || `${c.ko} / ${c.en} (${c.code})`.toLowerCase() === input)?.code || "";
}

export function gksDocuments(draft: GksDraft) {
  return docCatalog.filter(d => d.degrees.includes(draft.degree) && (d.id !== "jbnu-submission" || (draft.school === "jbnu" && draft.track === "University")));
}

export function gksProgress(draft: GksDraft) {
  const required = gksDocuments(draft).filter(d => d.kind === "required");
  const ready = required.filter(d => draft.documents[d.id]?.stage === "ready").length;
  return { ready, total: required.length, percent: required.length ? Math.round(ready / required.length * 100) : 0 };
}

export function gksWriterTitle(form: GksForm) {
  return form === "f2" ? "FORM 2. PERSONAL STATEMENT" : "FORM 3. STUDY PLAN";
}

export function validateGksWriter(form: GksForm, data: Record<string, string>) {
  if (!data.fullName?.trim()) return "name";
  if (!writerFields[form].some(f => data[f.id]?.trim())) return "content";
  return "";
}
