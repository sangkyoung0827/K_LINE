import { parse } from "chrono-node";
import { Temporal } from "@js-temporal/polyfill";

type DateValue = { value: string; qualifier: string | null; endOfDay: boolean };
export type EventSchedule = { activity: DateValue | null; deadline: DateValue | null; timeZone: string; reference: string; deadlineConflict: boolean };
const pad = (value: number) => String(value).padStart(2, "0");
const periods: Record<string, string> = { 아침: "morning", 오전: "morning", 새벽: "early morning", 낮: "afternoon", 오후: "afternoon", 저녁: "evening", 밤: "night" };
const pending = /미정|미확정|추후|아직.*모르|\b(?:undecided|unknown|tbd)\b/i;

export function eventTimeZone(message: string) {
  const explicit = [...message.matchAll(/(?:Asia|Europe|America|Australia|Pacific|Africa)\/[A-Za-z_]+(?:\/[A-Za-z_]+)?/g)].at(-1)?.[0];
  if (explicit) { try { Temporal.Now.zonedDateTimeISO(explicit); return explicit; } catch { /* Ask rather than guess an invalid IANA zone. */ } }
  const zones = [...message.matchAll(/한국\s*(?:표준)?시간|서울\s*시간|\bKST\b|독일\s*(?:현지\s*)?시간|베를린\s*시간|\bCET\b|\bCEST\b/gi)];
  const last = zones.at(-1)?.[0];
  if (last) return /독일|베를린|CET/i.test(last) ? "Europe/Berlin" : "Asia/Seoul";
  if (/독일|뒤스부르크|뒤스부르그|에센\s*대학|\bGermany\b|\bDuisburg\b|\bEssen\b/i.test(message)) return "Europe/Berlin";
  return "Asia/Seoul";
}

export function naturalEventDate(input: string, reference: Date, kind: "activity" | "deadline", timeZone = "Asia/Seoul", previous?: string): DateValue | null {
  let text = input.normalize("NFKC").replace(/\d+\s*박\s*\d+\s*일/g, "");
  if (pending.test(text) || /주말|\bweekend\b/i.test(text)) return null;
  const local = Temporal.Instant.from(reference.toISOString()).toZonedDateTimeISO(timeZone);
  const base = Temporal.PlainDate.from(previous?.slice(0, 10) || local.toPlainDate().toString());
  const hasDay = /\d{4}-\d{2}-\d{2}|\d{1,2}\s*[월일]|\d{1,2}\/\d{1,2}|오늘|내일|모레|글피|이틀|사흘|요일|today|tomorrow|yesterday|\bin \d+ days?\b|\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(text);
  text = text.replace(/(열한|열두|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*시/g, (_, word: string) => `${({ 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열한: 11, 열두: 12 } as Record<string, number>)[word]}시`);
  text = text.replace(/(다음|이번)\s*달\s*(\d{1,2})\s*일/g, (_, which, day) => {
    const month = local.toPlainDate().with({ day: 1 }).add({ months: which === "다음" ? 1 : 0 });
    return ` ${month.year}-${pad(month.month)}-${pad(Number(day))} `;
  });
  text = text.replace(/(다다음|다음|이번|차|금)\s*주\s*([월화수목금토일])요일/g, (_, week, day) => {
    const monday = local.toPlainDate().subtract({ days: local.dayOfWeek - 1 });
    return ` ${monday.add({ days: (week === "다다음" ? 14 : /다음|차/.test(week) ? 7 : 0) + "월화수목금토일".indexOf(day) }).toString()} `;
  });
  text = text.replace(/([월화수목금토일])요일/g, (_, day) => ` ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]["월화수목금토일".indexOf(day)]} `)
    .replace(/(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, (_, year, month, day) => year ? ` ${year}-${pad(Number(month))}-${pad(Number(day))} ` : ` ${month}/${day} `)
    .replace(/(\d+)\s*일\s*(?:뒤|후)/g, " in $1 days ").replace(/이틀\s*(?:뒤|후)/g, " in 2 days ").replace(/사흘\s*(?:뒤|후)/g, " in 3 days ")
    .replace(/(?<!\d)(\d{1,2})\s*일(?!간|동안)/g, (_, day) => ` ${base.year}-${pad(base.month)}-${pad(Number(day))} `)
    .replace(/글피/g, " in 3 days ").replace(/모레/g, " in 2 days ").replace(/내일/g, " tomorrow ").replace(/오늘/g, " today ");
  const approximate = /(?:시|분)\s*(?:쯤|정도|경)|\b(?:around|about|approximately)\b/i.test(input);
  text = text.replace(/\b(?:around|about|approximately)\b/gi, " ");
  let invalidClock = false;
  text = text.replace(/(오전|오후|저녁|밤|아침|낮|새벽)?\s*(\d{1,2})\s*시(?:\s*(반|\d{1,2}\s*분))?/g, (_, period, rawHour, minutes) => {
    let hour = Number(rawHour); const minute = minutes === "반" ? 30 : Number(String(minutes || "0").replace(/\D/g, ""));
    if (hour > 23 || minute > 59 || period && (hour < 1 || hour > 12) || !period && hour > 0 && hour < 12) invalidClock = true;
    if (period) hour = period === "밤" && hour === 12 ? 0 : hour % 12 + (/오후|저녁|밤|낮/.test(period) ? 12 : 0);
    return ` at ${pad(hour)}:${pad(minute)} `;
  });
  if (invalidClock) return null;
  text = text.replace(/자정/g, " at 00:00 ").replace(/정오/g, " at 12:00 ").replace(/한국\s*(?:표준)?시간|한국\s*표준시|서울\s*시간/g, " KST ")
    .replace(/독일\s*(?:현지\s*)?시간|베를린\s*시간/g, " ");
  for (const [kr, en] of Object.entries(periods)) text = text.replaceAll(kr, ` ${en} `);
  const duration = kind === "deadline" ? /(?:신청|모집|접수)[\s\S]*?(\d+)\s*일\s*(?:간|동안)|(?:applications?|registration)[\s\S]*?for\s+(\d+)\s+days?/i.exec(input) : null;
  if (duration) {
    const days = Number(duration[1] || duration[2]);
    if (days < 1 || days > 365) return null;
    return { value: local.add({ days }).toString({ timeZoneName: "never", smallestUnit: "second" }), qualifier: null, endOfDay: false };
  }
  const dateReference = !hasDay && previous ? new Date(base.toZonedDateTime({ timeZone, plainTime: "12:00" }).epochMilliseconds) : reference;
  const results = parse(text, { instant: dateReference, timezone: Number(local.offsetNanoseconds) / 60e9 }, { forwardDate: hasDay && !/\d{4}-\d{2}-\d{2}/.test(text) });
  const dated = results.filter(result => result.start.isCertain("day"));
  const result = dated[0] || results[0];
  if (!result || !hasDay && !previous || dated.length > 1 || results.some(item => item.end)) return null;
  const start = result.start;
  const hasClock = /\bat\s*\d|\d:\d|\d\s*(?:am|pm)\b|\bnoon\b|\bmidnight\b|T\d{2}:/i.test(text);
  // Chrono may split a date and clock separated by Korean prose. Never use its
  // inferred noon as a supplied time; combine only one unambiguous explicit clock.
  const clocks = results.filter(item => item.start.isCertain("hour"));
  if (hasClock && clocks.length !== 1) return null;
  const clock = hasClock ? clocks[0].start : start;
  try {
    const date = Temporal.PlainDate.from({ year: start.get("year")!, month: start.get("month")!, day: start.get("day")! }, { overflow: "reject" });
    const period = Object.entries(periods).find(([kr]) => input.includes(kr));
    const englishPeriod = /\b(morning|afternoon|evening|night)\b/i.exec(input)?.[1];
    if (!hasClock && (period || englishPeriod)) return kind === "deadline" ? null : { value: date.toString(), qualifier: period ? `${period[0]} / ${period[1]}` : englishPeriod!, endOfDay: false };
    if (!hasClock && kind === "activity") return { value: date.toString(), qualifier: null, endOfDay: false };
    // Reject nonexistent or repeated DST wall times instead of silently shifting them.
    const zoneSource = clock.isCertain("timezoneOffset") ? clock : start;
    const offset = zoneSource.isCertain("timezoneOffset") ? zoneSource.get("timezoneOffset")! : null;
    const zone = offset === null ? timeZone : `${offset < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
    const zoned = Temporal.ZonedDateTime.from({ timeZone: zone, year: date.year, month: date.month, day: date.day,
      hour: hasClock ? clock.get("hour")! : 23, minute: hasClock ? clock.get("minute") || 0 : 59, second: hasClock ? clock.get("second") || 0 : 59 }, { overflow: "reject", disambiguation: "reject" });
    return { value: zoned.toString({ timeZoneName: "never", smallestUnit: "second" }), qualifier: approximate ? "약 / approximately" : /이후|부터|\bafter\b|\bfrom\b/i.test(input) ? "이후 / onwards" : null, endOfDay: !hasClock };
  } catch { return null; }
}

export function resolveEventSchedule(message: string, reference = new Date()): EventSchedule {
  const timeZone = eventTimeZone(message);
  let activity: DateValue | null = null, deadline: DateValue | null = null;
  let followup = false;
  const clauses = message.replace(/추가 답변\s*\/\s*Follow-up answer:/g, "\n__FOLLOWUP__\n")
    .replace(/(?=(?:신청|모집|접수)(?:은|는|을|기간|\s*마감|\s*\d)|마감(?:은|일|\s*[:：])|\bdeadline\b|\bapplications? close\b)/gi, "\n")
    .split(/[\n;；。]+|[.!?](?:\s|$)|,\s*(?=(?:신청|모집|마감|deadline))/i).map(part => part.trim()).filter(Boolean);
  for (const clause of clauses) {
    if (clause === "__FOLLOWUP__") { followup = true; continue; }
    const explicitDeadline = /마감|deadline|applications? close|registration.*(?:until|for|close)|(?:신청|모집|접수)(?:은|는|을|기간|\s*\d|[\s:：]+(?:오늘|내일|모레|이번|다음))/i.test(clause);
    const deadlineClause = explicitDeadline || Boolean(followup && activity && !deadline && !/행사|활동|모임|수업|\bevent\b|\bactivity\b/i.test(clause));
    const parsed = naturalEventDate(clause, reference, deadlineClause ? "deadline" : "activity", timeZone, (deadlineClause ? deadline?.value : activity?.value) || activity?.value);
    if (parsed) { if (deadlineClause) deadline = parsed; else activity = parsed; }
    else if (pending.test(clause) || /주말|\d\s*(?:시|월|일)|\d{4}-\d|내일|모레|오늘/i.test(clause)) { if (deadlineClause) deadline = null; else activity = null; }
  }
  const boundary = activity && (activity.value.length === 10 ? Temporal.PlainDate.from(activity.value).toZonedDateTime({ timeZone, plainTime: "23:59:59" }).toString({ timeZoneName: "never" }) : activity.value);
  const deadlineConflict = Boolean(boundary && deadline && Date.parse(deadline.value) > Date.parse(boundary));
  if (deadlineConflict) deadline = null;
  return { activity, deadline, timeZone, reference: reference.toISOString(), deadlineConflict };
}

export function scheduleEvidence(schedule: EventSchedule) {
  return [schedule.activity && `Event date: ${schedule.activity.value}`, schedule.deadline && `Application deadline: ${schedule.deadline.value}`].filter(Boolean).join("\n");
}

export function noticeHasMatchingSchedule(copy: string, values: (string | null)[], timeZone: string) {
  const expected = new Set(values.filter((value): value is string => Boolean(value && value.length > 10)).map(value => {
    const local = Temporal.Instant.from(value).toZonedDateTimeISO(timeZone);
    return `${local.toPlainDate()}T${pad(local.hour)}:${pad(local.minute)}`;
  }));
  const dates: { index: number; end: number; day: string }[] = [];
  for (const match of copy.matchAll(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)) dates.push({ index: match.index, end: match.index + match[0].length, day: `${match[1]}-${pad(Number(match[2]))}-${pad(Number(match[3]))}` });
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  for (const match of copy.matchAll(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi)) dates.push({ index: match.index, end: match.index + match[0].length, day: `${match[3]}-${pad(months.indexOf(match[2].toLowerCase()) + 1)}-${pad(Number(match[1]))}` });
  dates.sort((a, b) => a.index - b.index);
  const found = new Set<string>();
  for (const [index, date] of dates.entries()) {
    const suffix = copy.slice(date.end, Math.min(date.end + 160, dates[index + 1]?.index ?? copy.length)).split(/[\n.!?]/)[0];
    const clock = /\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\b/i.exec(suffix);
    if (!clock) continue;
    const hour = clock[3] ? Number(clock[1]) % 12 + (clock[3].toLowerCase() === "pm" ? 12 : 0) : Number(clock[1]);
    const value = `${date.day}T${pad(hour)}:${clock[2]}`;
    if (!expected.has(value)) return false;
    found.add(value);
  }
  return [...expected].every(value => found.has(value));
}
