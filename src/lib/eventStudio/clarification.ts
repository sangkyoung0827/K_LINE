export function eventClarification(missing: string[], title = "") {
  const questions: Record<string, [string, string]> = {
    activityDate: ["행사는 언제 시작하나요? 연도와 시작 시간, 시간대(예: 한국 시간)를 알려주세요.", "When does the event start? Include the year, start time and timezone."],
    applicationDeadline: ["신청은 언제 마감하나요? 날짜와 시간, 시간대를 알려주세요.", "When do applications close? Include the date, time and timezone."],
    applicationDeadlineTime: ["신청 마감은 몇 시인가요? 시간과 시간대를 알려주세요.", "What time do applications close? Include the timezone."],
    location: ["행사는 어디에서 진행하나요?", "Where will the event take place?"],
    capacity: ["몇 명을 모집하나요?", "How many participants can join?"],
  };
  const selected = [...new Set(missing)].flatMap(key => questions[key] ? [questions[key]] : []);
  if (selected.length && /\bMT\b|엠티/i.test(title)) selected.push([
    "MT의 종료 일시·숙박 여부, 참가비와 포함 내역, 주요 프로그램과 이동 방식도 알려주세요. 아직 미정인 항목은 미정이라고 답해 주세요.",
    "Also tell us the MT end date/time, whether it is overnight, the fee and what it covers, the program and transport. Mark undecided items as pending.",
  ]);
  return {
    ko: selected.map(([ko]) => ko).join("\n\n"),
    en: selected.map(([, en]) => en).join("\n\n"),
  };
}
