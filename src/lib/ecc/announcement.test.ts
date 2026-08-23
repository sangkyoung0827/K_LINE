import assert from "node:assert/strict";
import test from "node:test";
import {
  detectEccAnnouncementRequest,
  getCurrentEccAcademicTerm
} from "./announcement";

test("uses the current Seoul semester for an ECC re-registration notice", () => {
  const request = detectEccAnnouncementRequest(
    "우혁몬, ECC 재등록 공지문 만들어줘.",
    new Date("2026-08-23T12:00:00.000Z")
  );

  assert.ok(request);
  assert.equal(request.kind, "reregistration");
  assert.equal(request.termKo, "2026년 2학기");
  assert.match(request.fallback, /2026년 2학기 ECC 기존 회원 재등록 안내/);
  assert.match(request.fallback, /\[운영진 입력: 재등록 신청 링크\]/);
  assert.doesNotMatch(request.context, /student_number|raw_values|member_response rows:/);
});

test("calculates first semester in Seoul and ignores ordinary ECC questions", () => {
  assert.equal(
    getCurrentEccAcademicTerm(new Date("2026-02-15T03:00:00.000Z")).termKo,
    "2026년 1학기"
  );
  assert.equal(detectEccAnnouncementRequest("ECC 활동에는 무엇이 있어?"), null);
});
