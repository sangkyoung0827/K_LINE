import { clubHarness, qaRequest } from "./woohyukmon-club-harness.mjs";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

process.loadEnvFile(resolve("../kline-woohyukmon-app-checkpoint-20261006/.env.openai.local"));
const h = await clubHarness({ liveAI: true });
const sourceData = {
  "@/app/api/ecc/activity-catalog/route": { activities: [{ id: "gathering", titleKo: "국제 교류 모임", titleEn: "International Gathering" }, { id: "mt", titleKo: "MT", titleEn: "MT" }] },
  "@/app/api/ecc/resources/route": { resources: [{ id: "qa-notice", title: "International Gathering 운영 공지", content: "모임 전날 조별 채팅방을 만들고 장소와 활동은 조원이 함께 정합니다. 조는 매주 바뀌며 비용은 각자 부담합니다." }] },
  "@/app/api/club-board-posts/route": { posts: [] },
  "@/app/api/hanhwal/introduction/route": { content: { titleKo: "함께 배우는 한국 활쏘기", bodyKo: "국궁의 기본 자세와 안전수칙, 호흡과 예절을 배우는 문화 공동체" } },
  "@/app/api/research/route": { items: [] },
  "@/app/api/siu/activities/route": { activities: [{ id: "qa-siu", title: "지역 문화 교류 봉사", short_description: "지역 문화관에서 한국인과 외국인이 함께 문화 행사를 돕는 프로그램", status: "published", application_count: 7 }], nextOffset: null },
  "@/app/api/ecc/applications/route": { applications: [
    ...Array.from({ length: 8 }, (_, i) => ({ type: "gathering", activityTitle: "International Gathering", nationality: i < 6 ? "France" : "South Korea", status: "pending" })),
    { type: "mt", activityTitle: "MT", nationality: "Vietnam", status: "pending" }
  ] },
  "@/app/api/hanhwal/applications/route": { applications: [] },
  "@/app/api/hanhwal/structured-activities/route": { activities: [] },
  "@/app/api/hanhwal/posts/route": { posts: [] },
  "@/app/api/jeju/programs/route": { programs: [] }
};
const cases = [
  { name: "exact reported cross-club SIU recommendation", scopes: ["ecc", "social_impact_union"], scope: "social_impact_union", message: "kline 전체적으로 봤을 때, 외국인들이 가장 좋아할만한 활동 데이터를 기반으로 다음에 소셜임팩트 유니온에서 행사를 한다고 하면 어떤 프로그램을 하면 좋을지 추천해봐", check: r => /[6육]|Gathering|교류/.test(r.summary) && /제안|추천|프로그램/.test(r.summary) && /신청|선호|만족|출석/.test(r.summary) && !/데이터를.*공유해.*주시면/.test(r.summary) },
  { name: "ordinary user receives public evidence, not private counts", scopes: [], message: "KLINE 전체 활동 데이터 기반으로 SIU에서 외국인과 할 만한 프로그램 추천해줘", check: r => /제안|추천|프로그램/.test(r.summary) && !/외국인.*6명|외국인.*여섯/.test(r.summary) },
  { name: "source outage does not mean no records and still allows grounded proposals", scopes: ["ecc", "social_impact_union"], scope: "ecc", resourceStatus: { "@/app/api/ecc/applications/route": 503 }, message: "KLINE 활동 데이터를 비교해서 외국인들이 좋아할 다음 SIU 행사를 추천해줘", check: r => /조회|연결|확인|제한|불가|실패|오류/.test(r.summary) && /제안|추천/.test(r.summary) },
  { name: "English evidence-based proposal", scopes: ["ecc", "social_impact_union"], message: "Based on all KLINE activity data, recommend a new Social Impact Union event for international students. Explain the evidence and limitations.", check: r => /gathering|exchange/i.test(r.summary) && /application|registration/i.test(r.summary) && /propos|recommend/i.test(r.summary) }
];
const results = [];
try {
  for (const item of cases) {
    h.state.scopes = item.scopes; h.state.resourceData = structuredClone(sourceData); h.state.resourceStatus = item.resourceStatus || {};
    const before = h.state.calls.length;
    try {
      const reply = await h.api.clubAssistantReply(await h.api.getClubAssistantAccess(), qaRequest({}), item);
      const calls = h.state.calls.slice(before);
      const wrongTotal = /9건\s*중\s*6건|9\s*applications?[^.\n]{0,25}(6\s*(foreign|international))/i.test(reply.summary);
      const record = { name: item.name, passed: Boolean(item.check(reply)) && !wrongTotal && calls.every(call => call.method === "GET"), model: reply.model, summary: reply.summary, reads: calls.length, writes: calls.filter(call => call.method !== "GET").length };
      results.push(record); console.log(JSON.stringify(record));
    } catch (error) { results.push({ name: item.name, passed: false, error: error.message }); console.log(JSON.stringify(results.at(-1))); }
  }
} finally { await h.close(); }
await writeFile(resolve("../outputs/woohyukmon-site-live-qa-20261014.json"), JSON.stringify({ checkedAt: new Date().toISOString(), realOpenAI: true, businessSources: "isolated synthetic fixtures; NOT production statistics", productionWrites: 0, results }, null, 2) + "\n");
if (results.some(item => !item.passed)) process.exitCode = 1;
