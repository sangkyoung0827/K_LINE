import { clubHarness, qaRequest } from "./woohyukmon-club-harness.mjs";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

process.loadEnvFile(resolve("../kline-woohyukmon-app-checkpoint-20261006/.env.openai.local"));
const h = await clubHarness({ liveAI: true });
const registrations = [
  { id: "qa-member-a", fullName: "격리 회원 A", studentId: "001234", paymentConfirmed: true, officialMember: true, adminNote: "Original note" },
  { id: "qa-member-b", fullName: "격리 회원 B", studentId: "001235", paymentConfirmed: false, officialMember: false, adminNote: "" }
];
const cases = [
  { name: "ordinary greeting across clubs", scopes: ["ecc", "hanhwal"], message: "안녕 오늘 좀 도와줘", check: (r, calls) => r.kind === "answer" && calls.length === 0 && !/어느.*(동아리|단체)/.test(r.summary) },
  { name: "informal current member lookup", scopes: ["ecc"], scope: "ecc", message: "회원들 회비는 어때?", check: (r, calls) => r.kind === "answer" && calls.some(c => c.resource.includes("member-registrations")) && /1|한/.test(r.summary) },
  { name: "contextual Excel export from another page", scopes: ["ecc", "hanhwal"], scope: "hanhwal", message: "그거 엑셀로", history: [{ role: "user", content: "ECC 회원 명부를 보여줘" }, { role: "assistant", content: "현재 가입자는 2명이며 회비 납부자와 미납자는 각 1명입니다." }], check: (r, calls) => r.scope === "ecc" && r.files?.some(file => file.name.endsWith(".xlsx")) && calls.every(c => c.resource.includes("ecc/")) },
  { name: "contextual English rewrite", scopes: ["ecc", "hanhwal"], message: "영어로 좀 더 자연스럽게", history: [{ role: "user", content: "친구들과 함께 편하게 대화하는 모임에 초대합니다. 이 문장을 다듬어줘." }, { role: "assistant", content: "친구들과 편하게 이야기 나누는 모임에 여러분을 초대합니다." }], check: (r, calls) => r.kind === "answer" && calls.length === 0 && /join|invite|chat|conversation|friends/i.test(r.summary) },
  { name: "essential club clarification", scopes: ["ecc", "hanhwal"], message: "회원들 정리해줘", check: (r, calls) => r.kind === "answer" && calls.length === 0 && /어느|어떤|선택|ECC|한활/.test(r.summary) },
  { name: "ambiguous mutation cannot guess target", scopes: ["ecc"], scope: "ecc", message: "그 사람 정회원 처리해", history: [{ role: "user", content: "ECC 가입자는 누가 있어?" }, { role: "assistant", content: "격리 회원 A와 격리 회원 B가 있습니다." }], check: r => r.kind === "answer" && /누구|어느|어떤|이메일|이름/.test(r.summary) },
  { name: "source outage gives an honest reply", scopes: ["ecc"], scope: "ecc", routeStatus: 503, message: "명부 좀 엑셀로 줘", check: r => r.kind === "answer" && !r.files?.length && /실패|못|문제|없|불가|않|어려/.test(r.summary) },
  { name: "notice drafting without publication", scopes: ["ecc"], message: "행사를 등록하거나 저장하지 말고, 친구들과 편하게 만나는 모임에 초대한다는 짧은 공지만 써줘", check: (r, calls) => r.kind === "answer" && calls.length === 0 && /초대|만나|함께/.test(r.summary) },
  { name: "application count is not lifetime attendance", scopes: ["ecc"], scope: "ecc", message: "ECC에서 international gathering 지금까지 누적 참여자가 몇명인지 알려주세요.", check: r => r.kind === "answer" && /신청|참석|기록|누적/.test(r.summary) },
  { name: "explicit fee change still needs confirmation", scopes: ["ecc"], scope: "ecc", message: "ECC 격리 회원 B의 회비를 납부 확인으로 바꿔줘", check: r => r.kind === "confirmation" && Boolean(r.token) }
];
const results = [];
try {
  for (const item of cases) {
    h.state.scopes = item.scopes; h.state.routeStatus = item.routeStatus || 200;
    h.state.data = { registrations: structuredClone(registrations) };
    h.state.resourceData = {
      "@/app/api/ecc/member-registrations/route": h.state.data,
      "@/app/api/ecc/activity-catalog/route": { activities: [{ id: "gathering", titleKo: "International Gathering", titleEn: "International Gathering", isOpen: true }] },
      "@/app/api/ecc/applications/route": { counts: { gathering: 1 }, applications: [{ id: "qa-application", type: "gathering", activityTitle: "International Gathering", name: "격리 신청자", status: "submitted", createdAt: "2026-10-14T00:00:00Z" }] },
      "@/app/api/ecc/roles/route": { members: [], roles: [] }
    };
    const before = h.state.calls.length;
    try {
      const reply = await h.api.clubAssistantReply(await h.api.getClubAssistantAccess(), qaRequest({}), item);
      const calls = h.state.calls.slice(before);
      const record = { name: item.name, passed: Boolean(item.check(reply, calls)) && calls.every(call => call.method === "GET"), kind: reply.kind, model: reply.model, summary: reply.summary, scope: reply.scope, files: reply.files?.map(file => file.name), reads: calls.length, writes: calls.filter(call => call.method !== "GET").length };
      results.push(record); console.log(JSON.stringify(record));
    } catch (error) { const record = { name: item.name, passed: false, error: error.message }; results.push(record); console.log(JSON.stringify(record)); }
  }
} finally { await h.close(); }
await writeFile(resolve("../outputs/woohyukmon-dialogue-live-qa-20261014.json"), JSON.stringify({ checkedAt: new Date().toISOString(), realOpenAI: true, businessSources: "isolated fixtures only", productionWrites: 0, results }, null, 2) + "\n");
if (results.some(item => !item.passed)) process.exitCode = 1;
