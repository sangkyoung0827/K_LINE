import { clubHarness, qaRequest } from "./woohyukmon-club-harness.mjs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

process.loadEnvFile(resolve("../kline-woohyukmon-app-checkpoint-20261006/.env.openai.local"));
const h = await clubHarness({ liveAI: true });
const results = [];
const memberData = structuredClone(h.state.data);
try {
  for (const [scope, message, expected] of [
    ["ecc", "ECC 회원 수와 회비 납부자 수를 조회해 주세요.", "answer"],
    ["hanhwal", "한활 회원 명부를 학번 이름 순으로 엑셀로 만들어 주세요.", "answer"],
    ["hanhwal", "한활 회원 등록 자료를 워드 문서로 만들어 주세요.", "answer"],
    ["social_impact_union", "소셜임팩트유니온 현재 활동을 조회해 주세요.", "answer"],
    ["jeju", "제주 프로그램 목록과 운영 현황을 보여 주세요.", "answer"],
    ["research", "연구자료 관리 목록을 조회해 주세요.", "answer"],
    ["ecc", "ECC 테스트 회원을 회비 미납으로 변경해 주세요.", "confirmation"],
    ["ecc", "ECC International Gathering 행사를 만들고 싶습니다. 날짜, 장소, 인원은 아직 정하지 않았습니다.", "confirmation"]
  ]) {
    h.state.scopes = [scope];
    h.state.data = scope === "social_impact_union" ? { activities: [{ id: "qa-activity", title: "격리 문화교류 프로그램", starts_at: "2026-11-07T18:00:00+09:00", status: "published" }], nextOffset: null }
      : scope === "jeju" ? { programs: [{ id: "qa-program", title: "격리 제주 체험", status: "open" }], places: [], applications: [] }
      : scope === "research" ? { items: [{ id: "qa-research", titleKo: "격리 문화연구", status: "draft", visibility: "private" }] }
      : structuredClone(memberData);
    const before = h.state.calls.length;
    try {
      const reply = await h.api.clubAssistantReply(await h.api.getClubAssistantAccess(), qaRequest({}), { scope, message });
      const record = { scope, expected, kind: reply.kind, success: reply.kind === expected && reply.model === "gpt-6-luna" && !reply.summary?.startsWith("조회한 자료를 표시합니다"), model: reply.model, summary: reply.summary, files: reply.files?.map(x => x.name) || [], reads: h.state.calls.slice(before).filter(x => x.method === "GET").length, writes: h.state.calls.slice(before).filter(x => x.method !== "GET").length };
      results.push(record); console.log(JSON.stringify(record));
    } catch (error) { const record = { scope, success: false, error: error.message }; results.push(record); console.log(JSON.stringify(record)); }
  }
  if (h.state.calls.some(x => x.method !== "GET")) throw Error("READ_ONLY_LIVE_PLANNING_TEST_WROTE_DATA");
} finally { await h.close(); }
await writeFile(resolve("../outputs/woohyukmon-club-live-qa-20261014.json"), JSON.stringify({ checkedAt: new Date().toISOString(), realOpenAI: true, databaseAndBusinessRoutes: "isolated local fixtures", productionWrites: 0, googleFormsCreated: 0, results }, null, 2));
if (results.some(x => !x.success)) process.exitCode = 1;
