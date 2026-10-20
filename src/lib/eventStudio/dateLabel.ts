export function displayEventDate(value: string, timeZone = "Asia/Seoul") {
  if (value.length === 10) return value;
  return `${new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value))} (${timeZone === "Asia/Seoul" ? "KST, UTC+09:00" : timeZone})`;
}
