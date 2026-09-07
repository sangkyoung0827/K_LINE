import assert from "node:assert/strict";
import test from "node:test";
import { adviceSystemInstruction, isConversationAdvice, isMemberSummaryRequest, retrievalQuery, shouldRetrieveKnowledge, shouldSearchExternal } from "./intent";

const firstMessage = "우혁몬, 어떤 회원이 나에게 자신이 게이인데, ECC에서 남자를 만날 수 있냐고 물어봤어.";
const followUp = "뭐라고 답변하면 좋을지 알려줘. 회원 데이터를 주는게 아니라.";

test("advice has a focused language and privacy contract rather than a club introduction", () => {
  const system = adviceSystemInstruction(firstMessage);
  assert.match(system, /한국어로만/);
  assert.match(system, /답장 예시 한 문단을 먼저/);
  assert.match(system, /비공개 정보는 공개하거나 추측하지/);
  assert.match(system, /실제 데이터를 수정하거나 승인했다고 말하지/);
  assert.doesNotMatch(adviceSystemInstruction("How should I reply?"), /한국어로만/);
});

test("interpersonal advice skips unrelated training while membership and notice guidance retains it", () => {
  assert.equal(shouldRetrieveKnowledge(firstMessage), false);
  assert.equal(shouldRetrieveKnowledge(retrievalQuery(followUp, [{ role: "user", content: firstMessage }])), false);
  assert.equal(shouldRetrieveKnowledge("회비 납부 방법에 대한 답변 작성해줘"), true);
  assert.equal(shouldRetrieveKnowledge("ECC 재등록 공지문 만들어줘"), true);
  assert.equal(shouldRetrieveKnowledge("업로드한 교육 자료를 참고해서 답변 만들어줘"), true);
});

test("reported member conversations and requests for wording are not member statistics", () => {
  for (const message of [firstMessage, followUp, "회원이 친구를 만날 수 있나요?", "현재 ECC 회원이 고민을 물어왔어", "A member asked me if he could meet a boyfriend in ECC. What should I say?"]) {
    assert.equal(isMemberSummaryRequest(message), false, message);
  }
  assert.equal(isConversationAdvice(firstMessage), true);
  assert.equal(isConversationAdvice(followUp), true);
  assert.equal(isConversationAdvice("회원이 '회비 납부 처리해 줘'라고 물어봤는데 뭐라고 답장할까?"), true);
});

test("actual Korean and English member count requests still resolve", () => {
  for (const message of ["ECC 회원 수 알려줘", "회원수가 몇이야?", "ECC 회원 현황", "총 회원 몇 명이야?", "ECC 회원 통계 보여줘", "member count", "How many ECC members are there?"]) {
    assert.equal(isMemberSummaryRequest(message), true, message);
  }
});

test("ordinary chat, advice, drafting and greetings never trigger automatic web search", () => {
  for (const message of [firstMessage, followUp, "안녕", "한국어로 연결 확인이라고만 답하세요.", "좀 더 짧게 써줘", "How should I reply?", "가입 방법을 설명해줘"]) {
    assert.equal(shouldSearchExternal(message), false, message);
  }
  assert.equal(shouldSearchExternal(firstMessage, { journeyNeedsPlaces: true }), false);
  assert.equal(shouldSearchExternal("오늘 날씨를 물어봤는데 뭐라고 답장할까?"), false);
});

test("explicit research, current facts and data collection remain available", () => {
  for (const message of ["인터넷에서 검색해줘", "추가 조사해줘", "Search the web for campus support resources", "제주 오늘 날씨", "최신 뉴스 알려줘"]) {
    assert.equal(shouldSearchExternal(message), true, message);
  }
  assert.equal(shouldSearchExternal("뭐라고 답하면 좋을지 웹 검색해줘"), true);
  assert.equal(shouldSearchExternal("제품 가격 조사", { businessCollection: true }), true);
  assert.equal(shouldSearchExternal("제주 음식점 추천", { journeyNeedsPlaces: true }), true);
  assert.equal(shouldSearchExternal("막걸리 가격 분석", { traditionalLiquorNeedsResearch: true }), true);
  assert.equal(shouldSearchExternal("막걸리 가격 분석", { hasInternalAnswer: true }), false);
});

test("follow-up retrieval retains the user topic, not prior assistant mistakes", () => {
  const history = [
    { role: "user", content: firstMessage },
    { role: "assistant", content: "ECC 회원 현황: 전체 203명" }
  ];
  assert.equal(retrievalQuery(followUp, history), `${firstMessage}\n${followUp}`);
  assert.equal(retrievalQuery("내일 제주 날씨", history), "내일 제주 날씨");
  assert.equal(retrievalQuery(followUp, []), followUp);
  assert.equal(retrievalQuery("그거 웹 검색해줘", history).includes("전체 203명"), false);
});
