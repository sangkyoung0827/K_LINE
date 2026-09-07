import assert from "node:assert/strict";
import test from "node:test";
import { isActivityReadRequest, isPersonalRecallRequest, shouldRetrieveKnowledge, personalRecallInstruction } from "./intent";

test("event conversation and memory are not live activity queries", () => {
  for (const message of [
    "[기능 점검] 이번 점검의 행사명은 은빛나침반입니다. 한 문장으로 확인해줘.",
    "이전 대화에서 정한 행사명이 뭐였지?",
    "MT 활동 아이디어 추천해줘",
    "개강총회 공지 써줘",
    "어떤 회원이 MT 신청자가 몇 명인지 물어봤어. 뭐라고 답하면 좋을까?",
    "Suggest an event idea"
  ]) assert.equal(isActivityReadRequest(message), false, message);
});

test("explicit activity statistics and registration status still use live data", () => {
  for (const message of [
    "현재 모집 중인 행사 알려줘", "ECC 활동 현황", "개강총회 신청자 명단",
    "MT 신청자 몇 명이야?", "International Gathering 성비", "신청자 국적 통계",
    "English Class 마감됐어?", "List open activities", "MT applicant statistics"
  ]) assert.equal(isActivityReadRequest(message), true, message);
});

test("personal recall uses private conversation evidence, not unrelated training searches", () => {
  const question = "[기능 점검] 이전 대화에서 정한 점검 행사명이 무엇이었는지 한 문장으로 알려줘.";
  assert.equal(isPersonalRecallRequest(question), true);
  assert.equal(shouldRetrieveKnowledge(question), false);
  assert.equal(shouldRetrieveKnowledge("교육자료를 참고해서 ECC 재등록 공지를 써줘"), true);
  assert.match(personalRecallInstruction, /rather than inventing a memory/);
});
