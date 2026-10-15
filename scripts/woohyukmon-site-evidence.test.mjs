import assert from "node:assert/strict";
import { test } from "node:test";
import { clubHarness, decision, qaRequest } from "./woohyukmon-club-harness.mjs";

export function siteFixtures() {
  return {
    "@/app/api/ecc/activity-catalog/route": { activities: [{ id: "gathering", titleKo: "국제 교류 모임", titleEn: "International Gathering" }] },
    "@/app/api/ecc/resources/route": { resources: [{ id: "qa-notice", title: "Gathering 공지", content: "함께 장소를 고르고 매주 다른 조로 활동합니다." }] },
    "@/app/api/club-board-posts/route": { posts: [] },
    "@/app/api/hanhwal/introduction/route": { content: { titleKo: "한활", bodyKo: "함께 배우는 국궁" } },
    "@/app/api/research/route": { items: [{ id: "qa-research", titleKo: "한국문화 체험", status: "published", visibility: "public", isSample: false }, { id: "private", titleKo: "PRIVATE_DRAFT_DO_NOT_LEAK", status: "draft", visibility: "private" }] },
    "@/app/api/siu/activities/route": { activities: [{ id: "qa-siu", title: "지역 문화 교류 봉사", status: "published", application_count: 7, creator_user_key: "PRIVATE_OWNER", contact_note: "PRIVATE_CONTACT", open_chat_url: "PRIVATE_CHAT" }], nextOffset: null },
    "@/app/api/ecc/applications/route": { applications: [
      { id: "qa-a", type: "gathering", activityTitle: "International Gathering", nationality: "France", name: "PRIVATE_NAME", email: "PRIVATE_EMAIL", otherRequests: "PRIVATE_REFLECTION" },
      { id: "qa-b", type: "gathering", activityTitle: "International Gathering", nationality: "Vietnam" },
      { id: "qa-c", type: "gathering", activityTitle: "International Gathering", nationality: "South Korea" },
      { id: "qa-d", type: "gathering", activityTitle: "International Gathering", nationality: "Unknown" },
      { id: "qa-e", type: "mt", activityTitle: "MT", nationality: "France", status: "cancelled" }
    ] },
    "@/app/api/hanhwal/applications/route": { applications: [] },
    "@/app/api/hanhwal/structured-activities/route": { activities: [], submissions: [{ userEmail: "PRIVATE_SUBMISSION", payload: { reflection: "PRIVATE_BODY" } }] },
    "@/app/api/hanhwal/posts/route": { posts: [] },
    "@/app/api/jeju/programs/route": { programs: [] },
    "@/app/api/woohyukmon/knowledge/search/route": { results: [{ fileName: "Gathering 운영 공지", content: "전날 조별 채팅방을 만들고 주별로 조를 바꿉니다.", fileId: "PRIVATE_FILE" }] }
  };
}

test("natural club and event wording triggers evidence retrieval, not generic conversation", async () => {
  const h = await clubHarness();
  try {
    for (const message of [
      "우혁몬, ECC 관련 데이터를 기반으로 다음 이벤트를 기획해줘.",
      "ECC 데이터로 다음 이벤트 추천해줘",
      "한활 데이터를 기반으로 다음 이벤트를 기획해줘",
      "Plan the next ECC event based on our data"
    ]) assert.equal(h.api.needsSiteEvidence(message), true, message);
    for (const message of ["안녕하세요", "오늘 저녁 메뉴 추천해줘", "Help me plan my day", "ECC 회원 명부 조회"])
      assert.equal(h.api.needsSiteEvidence(message), false, message);
  } finally { await h.close(); }
});

test("the reported ECC event prompt preloads actual authorized sources before planning", async () => {
  const h = await clubHarness();
  try {
    h.state.resourceData = siteFixtures();
    h.state.decisions.push({ ...decision("answer", ""), answer: "조회 자료와 제안을 구분합니다." });
    await h.api.clubAssistantReply(await h.api.getClubAssistantAccess(), qaRequest({}), {
      scope: "ecc", message: "우혁몬, ECC 관련 데이터를 기반으로 다음 이벤트를 기획해줘."
    });
    assert.match(h.state.lastPrompt.instructions, /foreignApplications\\?":2/);
    assert.match(h.state.lastPrompt.instructions, /Do not describe a topic as well-received/);
    assert.ok(h.state.calls.some(call => call.resource.includes("ecc/applications")));
    assert.ok(h.state.calls.every(call => call.method === "GET"));
    assert.doesNotMatch(h.state.lastPrompt.instructions, /PRIVATE_/);
  } finally { await h.close(); }
});

test("public discovery is available without management grants, but never touches private sources", async () => {
  const h = await clubHarness();
  try {
    h.state.email = ""; h.state.scopes = []; h.state.resourceData = siteFixtures();
    const response = await h.api.siteData(new Request("http://qa/api/woohyukmon/site-data?q=문화"));
    assert.match(response.headers.get("cache-control"), /private.*no-store/);
    const result = await response.json(), json = JSON.stringify(result);
    assert.match(json, /한국문화 체험|지역 문화 교류/);
    assert.doesNotMatch(json, /PRIVATE_|foreignApplications/);
    assert.equal(result.sources.find(item => item.source === "ecc_applications").status, "not_authorized");
    assert.ok(h.state.calls.every(call => call.method === "GET"));
    assert.equal(h.state.calls.length, 6);
  } finally { await h.close(); }
});

test("cross-club recommendation preloads authorized aggregate data despite a SIU page selection", async () => {
  const h = await clubHarness();
  try {
    h.state.scopes = ["ecc", "social_impact_union"];
    h.state.resourceData = siteFixtures();
    h.state.decisions.push({ ...decision("answer", ""), answer: "국제 교류를 결합한 지역 문화 봉사 프로그램을 제안합니다." });
    const reply = await h.api.clubAssistantReply(await h.api.getClubAssistantAccess(), qaRequest({}), {
      scope: "social_impact_union", message: "kline 전체적으로 봤을 때, 외국인들이 가장 좋아할만한 활동 데이터를 기반으로 다음에 소셜임팩트 유니온에서 행사를 한다고 하면 어떤 프로그램을 하면 좋을지 추천해봐"
    });
    assert.equal(reply.kind, "answer");
    const prompt = h.state.lastPrompt.instructions;
    assert.match(prompt, /foreignApplications\\?":2/);
    assert.match(prompt, /koreanApplications\\?":1/);
    assert.match(prompt, /unknownNationality\\?":1/);
    assert.doesNotMatch(prompt, /PRIVATE_|qa-a|qa-b/);
    assert.ok(h.state.calls.some(call => call.resource.includes("ecc/applications")));
    assert.ok(h.state.calls.some(call => new URL(call.url).searchParams.get("mode") === "admin"));
    assert.ok(h.state.calls.every(call => call.method === "GET"));
    assert.equal(reply.scope, undefined);
  } finally { await h.close(); }
});

test("permission failure, outage, empty and partial pagination remain distinguishable", async () => {
  const h = await clubHarness();
  try {
    h.state.scopes = ["ecc", "hanhwal"]; h.state.resourceData = siteFixtures();
    h.state.resourceStatus = { "@/app/api/ecc/applications/route": 403, "@/app/api/ecc/resources/route": 503 };
    h.state.resourcePages = { "@/app/api/siu/activities/route": Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i * 20, { activities: [{ id: `qa-${i}`, title: `공개 행사 ${i}`, status: "published" }], nextOffset: (i + 1) * 20 }])) };
    const result = await h.api.loadSiteEvidence(await h.api.getClubAssistantAccess(), qaRequest({}), "활동 추천");
    const source = id => result.sources.find(item => item.source === id);
    assert.equal(source("ecc_applications").status, "not_authorized");
    assert.equal(source("ecc_library").status, "unavailable");
    assert.equal(source("hanhwal_applications").status, "empty");
    assert.equal(source("siu_public_events").status, "partial");
    assert.equal(source("siu_public_events").returnedRows, 8);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_/);
    assert.equal(h.state.calls.filter(call => call.resource.includes("siu/activities")).length, 8);
  } finally { await h.close(); }
});

test("uploaded knowledge is included only with developer scope and its existing guard", async () => {
  const h = await clubHarness();
  try {
    h.state.scopes = []; h.state.resourceData = siteFixtures(); h.state.developer = true;
    const result = await h.api.loadSiteEvidence(await h.api.getClubAssistantAccess(), qaRequest({}), "Gathering 公지");
    assert.match(JSON.stringify(result), /Gathering 운영 공지/);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_FILE/);
    const call = h.state.calls.find(call => call.resource.includes("knowledge/search"));
    assert.equal(call.method, "POST"); assert.deepEqual(call.body, { query: "Gathering 公지", limit: 8 });
    assert.ok(h.state.calls.every(call => call.method === "GET" || call.resource.includes("knowledge/search")));
  } finally { await h.close(); }
});

test("source discovery is read-only and model cannot supply URLs, SQL, permissions or file access", async () => {
  const h = await clubHarness();
  try {
    const access = await h.api.getClubAssistantAccess();
    for (const method of ["POST", "PATCH", "DELETE"]) assert.throws(() => h.api.assertCapability(access, { capability: "site_evidence", method, query: {}, body: {} }));
    assert.throws(() => h.api.assertCapability(access, { capability: "site_evidence", method: "GET", query: { url: "http://private.test" }, body: {} }));
    assert.deepEqual(h.api.applicationEvidence([{ type: "gathering", nationality: "한국" }, { type: "gathering", nationality: "korean" }, { type: "gathering", nationality: "" }])[0], { activityId: "gathering", title: "gathering", returnedApplications: 3, foreignApplications: 0, koreanApplications: 2, unknownNationality: 1 });
    assert.equal(h.state.calls.length, 0);
  } finally { await h.close(); }
});

test("preloaded site evidence is reused even if the model requests a different search query", async () => {
  const h = await clubHarness();
  try {
    h.state.scopes = ["ecc"]; h.state.resourceData = siteFixtures();
    h.state.decisions.push(decision("read", "site_evidence", "GET", {}, { q: "Gathering" }));
    h.state.naturalAnswer = "A community culture day is a proposal, not a verified preference.";
    const reply = await h.api.clubAssistantReply(await h.api.getClubAssistantAccess(), qaRequest({}), { message: "Based on KLINE activity data, recommend an event." });
    assert.equal(reply.summary, h.state.naturalAnswer);
    assert.equal(h.state.calls.length, 7);
    assert.match(h.state.lastPrompt.instructions, /Reply in English/);
    assert.match(JSON.stringify(h.state.lastPrompt), /foreignApplications/);
    assert.ok(h.state.calls.every(call => call.method === "GET"));
  } finally { await h.close(); }
});

test("large multi-club context trims excerpts, never source status or complete server totals", async () => {
  const h = await clubHarness();
  try {
    h.state.scopes = ["ecc", "hanhwal", "social_impact_union", "jeju"]; h.state.developer = true;
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: `qa-${i}`, title: `공개 ${i} ` + "x".repeat(170), description: "y".repeat(1000), tags: Array(6).fill("z".repeat(40)), status: "published", visibility: "public", isSample: false }));
    h.state.resourceData = Object.fromEntries(Object.entries(siteFixtures()).map(([path, data]) => [path, path.endsWith("applications/route") ? { applications: rows.map(row => ({ type: row.id, activityTitle: row.title, nationality: "France" })) } : path.endsWith("introduction/route") ? data : Object.fromEntries(Object.keys(data).filter(key => Array.isArray(data[key])).map(key => [key, rows]))]));
    const result = await h.api.loadSiteEvidence(await h.api.getClubAssistantAccess(), qaRequest({}), "활동 비교 추천");
    assert.ok(JSON.stringify(result).length <= 32000);
    assert.equal(result.sources.length, 13);
    assert.ok(result.sources.some(source => source.contextTruncated));
    for (const id of ["ecc_applications", "hanhwal_applications"]) {
      const source = result.sources.find(source => source.source === id);
      assert.equal(source.completeServerTotals.returnedApplications, 100);
      assert.equal(source.completeServerTotals.foreignApplications, 100);
      assert.equal(source.activityGroups, 100);
      assert.ok(source.displayedGroups < source.activityGroups);
    }
  } finally { await h.close(); }
});
