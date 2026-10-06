// Read-only content audit: no OAuth, database, form creation or publication calls.
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

Object.assign(process.env, {
  GOOGLE_FORMS_AUTOMATION_ENABLED: "true", GOOGLE_FORMS_ENVIRONMENT: "test",
  GOOGLE_FORMS_AI_PLANNING_ENABLED: "true", GOOGLE_FORMS_AI_EXISTING_API_ENABLED: "true",
});
delete process.env.VERCEL_ENV;
const temp = mkdtempSync(join(tmpdir(), "kline-notice-audit-"));
await build({
  stdin: { contents: "export { generateActivityNotice, noticeBody } from './src/lib/googleForms/planning'; export { googleFormTemplates, draftFromTemplate } from './src/lib/googleForms/templates'; export { planNewActivity } from './src/lib/googleForms/aiPlanning';", resolveDir: process.cwd(), loader: "ts" },
  outfile: join(temp, "audit.cjs"), bundle: true, platform: "node", format: "cjs", packages: "external",
  plugins: [{ name: "read-only", setup(builder) {
    builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "audit" }));
    builder.onResolve({ filter: /^@\/lib\/supabaseServer$/ }, () => ({ path: "clean", namespace: "audit" }));
    builder.onResolve({ filter: /^@\/lib\/woohyukmon\/generation$/ }, () => ({ path: "generation", namespace: "audit" }));
    builder.onLoad({ filter: /.*/, namespace: "audit" }, ({ path }) => ({ loader: "js", contents: path === "clean" ? 'export const cleanText=(value,max=240)=>typeof value==="string"?value.trim().slice(0,max):"";' : path === "generation" ? 'export const hasGenerationProvider=()=>false; export const generateAnswer=()=>{throw new Error("Local generation disabled; use existing public API only");};' : "" }));
  } }],
});
const api = (await import(pathToFileURL(join(temp, "audit.cjs")).href)).default;
const records = [];
for (const template of api.googleFormTemplates.filter(item => item.questions.length)) {
  const draft = api.draftFromTemplate(template.id === "general_activity" ? "general" : "ecc", template.id, template.label);
  const notice = api.generateActivityNotice(draft);
  records.push({ case: template.id, source: "current preset", notice, questions: draft.questions.map(item => item.title),
    findings: [
      !["ecc_gathering", "ecc_english_class"].includes(template.id) && "Only generic preset guidance is available; event-specific details are not verified.",
      !draft.activityDate && template.id !== "ecc_english_class" && "No confirmed activity date/time.",
    ].filter(Boolean),
    linkSeparated: !/https?:|GOOGLE_FORM_URL/.test(notice),
  });
}
for (const message of [
  "처음 여는 ECC 한국 차 시음과 전통 문양 엽서 만들기 활동 신청폼을 만들어줘. 일시: 2026-10-24T15:00+09:00. 신청 마감: 2026-10-23T18:00+09:00. 장소: 전북대학교 동아리방. 참가자는 차에 대한 관심과 만들고 싶은 엽서 문양을 알려주면 좋겠어.",
  "처음 여는 ECC 도시 소리 산책 활동 신청폼을 만들어줘. 함께 도시의 소리를 관찰하고 짧게 소감을 나누는 활동이야. 날짜, 장소, 비용은 아직 정하지 않았어.",
]) {
  console.log("Testing live Woohyukmon draft:", message);
  try {
    const { draft } = await api.planNewActivity(message);
    const notice = api.generateActivityNotice(draft);
    records.push({ case: draft.title, source: "live existing Woohyukmon API", message, draft, notice,
      findings: [...(!draft.activityDate ? ["No date/time supplied; must remain unspecified."] : [])],
      bilingualIntroduction: Boolean(draft.descriptionKo && draft.descriptionEn && notice.includes(draft.descriptionKo) && notice.includes(draft.descriptionEn)),
      linkSeparated: !/https?:|GOOGLE_FORM_URL/.test(notice),
    });
    console.log(JSON.stringify({ title: draft.title, questions: draft.questions.length, description: draft.description, activityDate: draft.activityDate, location: draft.location }));
  } catch (error) {
    records.push({ case: message, source: "live existing Woohyukmon API", error: error.message });
    console.log("Draft failed:", error.message);
  }
}
const output = "docs/google-forms-notice-verified-20261006.json";
writeFileSync(output, JSON.stringify({ scope: "Read-only generated-content audit. No forms created, submitted, published or deployed. Provider output requires administrator review.", records }, null, 2));
console.log("Audit saved:", output);
console.log(JSON.stringify(records.map(({ case: name, source, findings, linkSeparated, error }) => ({ name, source, findings, linkSeparated, error })), null, 2));
