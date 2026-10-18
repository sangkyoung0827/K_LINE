// Actual OpenAI audit. Jobs/quotas are local Postgres; Google writes stay mocked.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { eventHarness } from "./event-studio-harness.mjs";

if (!process.argv.includes("--approved-live-ai")) throw Error("LIVE_AI_APPROVAL_REQUIRED");
if (!process.env.MT_AUDIT_KEY_FILE || !process.env.MT_AUDIT_OUTPUT) throw Error("LOCAL_PATHS_REQUIRED");
const settings = parseEnv(await readFile(process.env.MT_AUDIT_KEY_FILE, "utf8"));
process.env.OPENAI_API_KEY = settings.OPENAI_API_KEY;
process.env.WOOHYUKMON_PREVIEW_OPENAI_ENABLED = "true";
const h = await eventHarness({ liveOpenAI: true });
const request = "[연동 검증 전용] ECC MT 신청자를 받는 구글폼과 한국어·영어 공지를 만들어 주세요. 모집 인원은 50명입니다. 프로그램은 우혁몬이 ECC 자료의 문화교류 취지를 참고해 제안해 주세요. 부족한 현재 행사 정보는 먼저 질문해 주세요. 실제 모집 공지가 아닙니다.";
const answer = "모두 실제 행사가 아닌 연동 검증용 가상 정보입니다. 행사 일시 2026-10-24T13:00:00+09:00, 당일 MT이며 종료 2026-10-24T18:00:00+09:00, 숙박 없음. 장소는 검증용 가상 ECC 교류공간입니다. 신청 마감 2026-10-23T18:00:00+09:00. 모집 인원 50명. 검증용 참가비는 0원이며 숙식·교통·물품 제공은 없습니다. 이동은 개별 이동입니다. 주요 프로그램은 ECC 문화교류 자료를 참고해 우혁몬이 구체적인 제안으로 구성해 주세요. 실 모집은 시작하지 않습니다.";
const results = [];
let failure = null;
try {
  for (const [entry, message] of [
    ["natural_language", request],
    ["template_tab", "활동 제목: [연동 검증 전용] ECC MT\n활동 유형: ECC MT\n모집 인원은 50명입니다. 프로그램은 ECC 자료를 참고해 제안하고, 부족한 현재 행사 정보는 먼저 질문해 주세요. 실제 모집은 아닙니다."],
  ]) {
    const initial = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message });
    assert.equal(initial.token, null);
    assert.equal(initial.job.plan.capacity, 50);
    assert.ok(initial.missing.includes("activityDate"));
    const refined = await h.api.studioOperation(h.access(), { action: "refine", jobId: initial.job.id, revision: initial.job.revision, message: answer });
    assert.deepEqual(refined.missing, []); assert.ok(refined.token);
    assert.equal(refined.job.id, initial.job.id);
    assert.equal(refined.job.plan.capacity, 50);
    assert.equal(refined.job.plan.location, "검증용 가상 ECC 교류공간");
    assert.equal(refined.job.plan.activityDate, "2026-10-24T13:00:00+09:00");
    assert.equal(refined.job.plan.applicationDeadline, "2026-10-23T18:00:00+09:00");
    assert.doesNotMatch(refined.job.plan.noticeKo + refined.job.plan.noticeEn, /그룹은 매주|next application will be restricted|groups change weekly/i);
    assert.match(refined.job.plan.noticeKo, /제안/); assert.match(refined.job.plan.noticeEn, /propos|suggest/i);
    results.push({ entry, request: message, answer, initial, refined });
    console.log(JSON.stringify({ entry, actualModel: refined.job.ai_metadata.model, capacity: 50, questions: refined.job.plan.questions.length, missing: refined.missing, liveGoogle: false }));
  }
  assert.equal(h.control.externalCreates, 0);
} catch (error) { failure = error.message; throw error; }
finally {
  await writeFile(process.env.MT_AUDIT_OUTPUT, JSON.stringify({ at: new Date().toISOString(), actualOpenAI: true, liveGoogle: false, productionWrites: 0, aiCalls: h.control.aiCalls, failure, results, rawAIOutputs: h.control.liveAIOutputs }, null, 2), { mode: 0o600 });
  await h.close();
}
