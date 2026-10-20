import assert from "node:assert/strict";
import { test } from "node:test";
import { naturalEventDate, noticeHasMatchingSchedule, resolveEventSchedule } from "./schedule";
const now = new Date("2026-10-20T08:00:00Z");

test("prose between a date and clock never substitutes Chrono's implied noon", () => {
  for (const prose of ["독일 현지", "행사 시작 시간은", "모임을 시작하는 시간은"]) {
    assert.equal(naturalEventDate(`2026년 11월 20일 ${prose} 저녁 7시입니다`, now, "activity", "Europe/Berlin")?.value, "2026-11-20T19:00:00+01:00");
  }
  const actualRequest = "행사 일시는 2026년 11월 20일 독일 현지 저녁 7시입니다. 신청은 2026년 10월 30일까지, 그날이 끝날 때까지 받습니다. 모집 인원은 50명입니다. 장소는 독일 검증용 임시 장소입니다.";
  assert.equal(resolveEventSchedule(actualRequest, now).activity?.value, "2026-11-20T19:00:00+01:00");
  assert.equal(resolveEventSchedule(actualRequest, now).deadline?.value, "2026-10-30T23:59:59+01:00");
  assert.equal(naturalEventDate("2026-11-20 at 19:00 or at 20:00", now, "activity"), null);
});
test("participant copies must match both local calendar days and clock times", () => {
  const values = ["2026-11-20T19:00:00+01:00", "2026-10-30T23:59:59+01:00"];
  for (const copy of ["일시 2026년 11월 20일 19:00 독일 현지 시간. 마감 2026년 10월 30일 23:59 독일 현지 시간.", "Event: 20 November 2026 at 7:00 pm CET. Apply by 30 October 2026 at 23:59 CET."]) {
    assert.equal(noticeHasMatchingSchedule(copy, values, "Europe/Berlin"), true);
    assert.equal(noticeHasMatchingSchedule(copy.replace(/19:00|7:00 pm/, "12:00"), values, "Europe/Berlin"), false);
    assert.equal(noticeHasMatchingSchedule(copy.replace(/20 November|11월 20일/, "21 November"), values, "Europe/Berlin"), false);
  }
  assert.equal(noticeHasMatchingSchedule("미정", values, "Europe/Berlin"), false);
});

test("the reported Germany follow-up resolves year, local clock, deadline and capacity independently", () => {
  const result = resolveEventSchedule("독일 뒤스부르크 에센 대학에서 하는 활쏘기 프로그램 관련 모집 공고 만드세요\n추가 답변 / Follow-up answer:\n11월 20일 저녁 7시 행사 시작입니다. 신청 마감은 10월 30일에 마감합니다. 모집 인원은 50명입니다.", now);
  assert.equal(result.activity?.value, "2026-11-20T19:00:00+01:00");
  assert.equal(result.deadline?.value, "2026-10-30T23:59:59+01:00");
  assert.equal(result.deadline?.endOfDay, true);
  assert.equal(result.timeZone, "Europe/Berlin");
  assert.equal(result.deadlineConflict, false);
});
test("Korean and English relative expressions preserve approximations without inventing a clock", () => {
  for (const [input, value] of [
    ["내일 저녁 일곱시 반쯤", "2026-10-21T19:30:00+09:00"],
    ["모레 오후 3시", "2026-10-22T15:00:00+09:00"],
    ["다음 주 금요일 저녁 7시", "2026-10-30T19:00:00+09:00"],
    ["tomorrow around 7pm", "2026-10-21T19:00:00+09:00"],
    ["다음 달 3일 오후 2시", "2026-11-03T14:00:00+09:00"],
  ]) assert.equal(naturalEventDate(input, now, "activity")?.value, value, input);
  assert.equal(naturalEventDate("내일 저녁쯤", now, "activity")?.value, "2026-10-21");
  assert.match(naturalEventDate("내일 저녁쯤", now, "activity")!.qualifier!, /evening/);
  assert.match(naturalEventDate("내일 저녁 7시쯤", now, "activity")!.qualifier!, /approximately/);
});
test("Berlin daylight saving, explicit offsets and invalid calendars do not silently shift", () => {
  assert.equal(naturalEventDate("2026년 7월 20일 저녁 7시", now, "activity", "Europe/Berlin")?.value, "2026-07-20T19:00:00+02:00");
  assert.equal(naturalEventDate("2026-11-20T19:00:00Z", now, "activity", "Europe/Berlin")?.value, "2026-11-20T19:00:00+00:00");
  for (const text of ["2026년 3월 29일 오전 2시 30분", "2026년 10월 25일 오전 2시 30분", "2026년 2월 30일", "2026년 13월 20일", "내일 오후 25시", "내일 7시", "이번 주말"]) {
    assert.equal(naturalEventDate(text, now, "activity", "Europe/Berlin"), null, text);
  }
});
test("new year and conflicting deadline preserve the event and ask only for a real correction", () => {
  assert.equal(naturalEventDate("1월 3일 오후 2시", new Date("2026-12-31T08:00:00Z"), "activity")?.value, "2027-01-03T14:00:00+09:00");
  const result = resolveEventSchedule("행사 11월 20일 저녁 7시. 신청 마감은 11월 21일입니다.", now);
  assert.equal(result.activity?.value, "2026-11-20T19:00:00+09:00");
  assert.equal(result.deadline, null); assert.equal(result.deadlineConflict, true);
  const fixed = resolveEventSchedule("행사 11월 20일 저녁 7시. 신청 마감은 11월 21일입니다.\n추가 답변 / Follow-up answer:\n마감은 11월 19일 오후 5시로 바꿔주세요.", now);
  assert.equal(fixed.deadline?.value, "2026-11-19T17:00:00+09:00");
  assert.equal(fixed.deadlineConflict, false);
});
