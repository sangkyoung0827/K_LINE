// Explicit opt-in live AI audit; all database and Google writes remain isolated/mocked.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { eventHarness } from "./event-studio-harness.mjs";

if (process.env.EVENT_NOTICE_LIVE_AUDIT !== "true") throw Error("LIVE_AUDIT_APPROVAL_REQUIRED");
if (!process.env.EVENT_NOTICE_AUDIT_OUTPUT) throw Error("PRIVATE_OUTPUT_REQUIRED");
if (process.env.EVENT_NOTICE_AUDIT_ENV) {
  const env = await readFile(process.env.EVENT_NOTICE_AUDIT_ENV, "utf8");
  for (const line of env.split("\n")) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
} else if (process.env.EVENT_NOTICE_AUDIT_USE_SERVER_ENV !== "true") {
  throw Error("LOCAL_ENV_OR_EXPLICIT_SERVER_ENV_REQUIRED");
}
// The key stays inside the approved server process; it is never logged or exported.
process.env.OPENAI_API_KEY = process.env.EVENT_AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const cases = [
  { id: "gathering", request: "[검증용 공지품질] ECC International Gathering의 기존 참여 방식과 운영 안내를 반영해 한영 공지를 작성해주세요. 날짜, 장소, 모집 인원은 아직 미정입니다. 실제 모집은 하지 않으며 공지 초안만 검수합니다.", known: true },
  { id: "meditation", request: "[검증용 공지품질] 외국인과 함께하는 명상 프로그램을 처음 만듭니다. 참여자가 무엇을 하는지 구체적인 제안 프로그램과 한영 공지를 작성해주세요. 날짜, 장소, 모집 인원은 아직 미정입니다. 의료 효과, 준비물 제공, 전문 강사 배정은 약속하지 마세요. 실제 모집은 하지 않습니다.", known: false },
  { id: "supplied-itinerary", request: "실제 모집이 아닌 시스템 검수용 행사입니다. 제목은 [검증용 20261026] ECC 문화교류 소모임으로 해주세요. 행사 일시는 2026년 11월 7일 오후 6시부터 오후 7시까지 한국 시간(Asia/Seoul)입니다. 신청 마감은 2026년 11월 6일 오후 6시 한국 시간이며 모집 인원은 3명, 참가비는 무료입니다. 장소는 검증용 온라인 공간이며 실제 접속 링크는 없습니다. 프로그램은 자기소개 10분, 서로의 일상 문화 이야기 30분, 소감 나누기 20분입니다. 질문은 이름(필수), 참여 시 기대하는 점(선택)으로 해주세요. 연락처, 학번, 건강정보는 수집하지 마세요. 한영 공지와 비공개 Google 폼을 함께 만들되 실제 운영 공지 게시나 모집 개시, 폼 공개는 하지 마세요.", known: false,
    expected: { activityDate: "2026-11-07T18:00:00+09:00", applicationDeadline: "2026-11-06T18:00:00+09:00", location: "검증용 온라인 공간", capacity: 3 } },
];
const h = await eventHarness({ liveOpenAI: true });
const results = [];
try {
  for (const item of cases) {
    const firstOutput = h.control.liveAIOutputs.length;
    let generated;
    try {
      generated = await h.api.generateEventPlan(`qa-${item.id}@example.test`, "ecc", item.request);
      h.api.assertNoticeQuality(generated.plan, item.request);
      for (const field of ["activityDate", "applicationDeadline", "location", "capacity"]) assert.equal(generated.plan[field], item.expected?.[field] ?? null);
      assert.equal(generated.plan.requiresReview, true);
      assert.doesNotMatch(generated.plan.noticeKo + generated.plan.noticeEn, /https?:|process notice reviewed|15,?000|Tongjip/i);
      assert.ok(generated.plan.questions.every(question => !/email|phone|health|religion|이메일|전화|건강|종교/i.test(question.title)));
      if (!item.known) assert.doesNotMatch(generated.plan.noticeKo + generated.plan.noticeEn, /next application will be restricted|그룹은 매주/);
      if (item.expected) for (const copy of [generated.plan.noticeKo, generated.plan.noticeEn]) for (const minutes of [10, 30, 20]) assert.match(copy, new RegExp(`${minutes}[ -]*(?:분|minutes?\\b|mins?\\b)`, "i"));
      results.push({ ...item, status: "passed", ...generated });
    } catch (error) {
      const candidates = h.control.liveAIOutputs.slice(firstOutput).flatMap(response => (response.output || []).flatMap(part => part.content || []).filter(part => part.type === "output_text").map(part => part.text));
      results.push({ ...item, status: "failed", error: error instanceof Error ? error.message : "AUDIT_FAILURE", ...(generated || {}), candidates });
    }
    const record = results.at(-1);
    const serialized = JSON.stringify(record);
    const chunks = Array.from({ length: Math.ceil(serialized.length / 900) }, (_, index) => serialized.slice(index * 900, (index + 1) * 900));
    console.log("NOTICE_AUDIT_CASE " + JSON.stringify({ id: record.id, status: record.status, error: record.error, metadata: record.metadata,
      chunks: chunks.length, sha256: createHash("sha256").update(serialized).digest("hex") }));
    chunks.forEach((text, index) => console.log("NOTICE_AUDIT_CHUNK " + JSON.stringify({ id: record.id, index, total: chunks.length, text })));
  }
  assert.equal(h.control.externalCreates, 0);
  const report = { generatedAt: new Date().toISOString(), results, externalGoogleWrites: 0, productionDatabaseWrites: 0, liveAI: true };
  await writeFile(process.env.EVENT_NOTICE_AUDIT_OUTPUT, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log("NOTICE_AUDIT_SUMMARY " + JSON.stringify({ cases: results.length, passed: results.filter(item => item.status === "passed").length, externalGoogleWrites: 0, productionDatabaseWrites: 0 }));
  assert.ok(results.every(item => item.status === "passed"), "NOTICE_AUDIT_HAS_FAILED_CASES");
} finally { await h.close(); }
