// Explicit opt-in live AI audit; all database and Google writes remain isolated/mocked.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { eventHarness } from "./event-studio-harness.mjs";

if (process.env.EVENT_NOTICE_LIVE_AUDIT !== "true") throw Error("LIVE_AUDIT_APPROVAL_REQUIRED");
if (!process.env.EVENT_NOTICE_AUDIT_ENV || !process.env.EVENT_NOTICE_AUDIT_OUTPUT) throw Error("LOCAL_ENV_AND_OUTPUT_REQUIRED");
const env = await readFile(process.env.EVENT_NOTICE_AUDIT_ENV, "utf8");
for (const line of env.split("\n")) {
  const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
}
const cases = [
  { id: "gathering", request: "international gathering 폼과 공지 만들어줘", known: true },
  { id: "english-class", request: "English Conversation Class 폼과 공지 만들어줘", known: true },
  { id: "meditation", request: "외국인과 함께하는 명상 프로그램 만들기", known: false },
  { id: "tea-postcards", request: "외국인과 함께하는 차 향과 엽서 교류 프로그램 만들어줘", known: false },
  { id: "photo-stories", request: "한복 색을 주제로 외국인과 함께하는 사진 이야기 모임 만들어줘", known: false },
];
const h = await eventHarness({ liveOpenAI: true });
const results = [];
try {
  for (const item of cases) {
    const result = await h.api.generateEventPlan(`qa-${item.id}@example.test`, "ecc", item.request);
    h.api.assertNoticeQuality(result.plan, item.request);
    for (const field of ["activityDate", "applicationDeadline", "location", "capacity"]) assert.equal(result.plan[field], null);
    assert.equal(result.plan.requiresReview, true);
    assert.doesNotMatch(result.plan.noticeKo + result.plan.noticeEn, /https?:|process notice reviewed|15,?000|Tongjip/i);
    assert.ok(result.plan.questions.every(question => !/email|phone|health|religion|이메일|전화|건강|종교/i.test(question.title)));
    if (item.id === "gathering") assert.match(result.plan.noticeEn, /one day before.*gathering|own activity costs/);
    if (!item.known) assert.doesNotMatch(result.plan.noticeKo + result.plan.noticeEn, /next application will be restricted|그룹은 매주/);
    results.push({ ...item, ...result });
    console.log(JSON.stringify({ id: item.id, model: result.metadata.model, retries: result.metadata.retries, questions: result.plan.questions.length, noticeKoLength: result.plan.noticeKo.length, noticeEnLength: result.plan.noticeEn.length }));
  }
  assert.equal(h.control.externalCreates, 0);
  await writeFile(process.env.EVENT_NOTICE_AUDIT_OUTPUT, JSON.stringify({ results, externalGoogleWrites: 0, productionDatabaseWrites: 0 }, null, 2), { mode: 0o600 });
} finally { await h.close(); }
