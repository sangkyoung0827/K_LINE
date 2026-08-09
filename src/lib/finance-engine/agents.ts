import "server-only";

import type { FinanceAgentId, FinanceAgentResult, FinanceMarketSnapshot } from "@/lib/finance-engine/types";
import type { FinanceLlmProvider } from "@/lib/finance-engine/provider";

const definitions: Record<FinanceAgentId, { name: string; role: string }> = {
  taro: { name: "TARO", role: "technical analysis" }, diana: { name: "DIANA", role: "fundamental analysis" }, nova: { name: "NOVA", role: "news analysis" }, vibe: { name: "VIBE", role: "sentiment analysis" }, bull: { name: "BULL", role: "bull case debate" }, bear: { name: "BEAR", role: "bear case debate" }, ace: { name: "ACE", role: "chief trader" }, risky: { name: "RISKY", role: "aggressive risk reviewer" }, safe: { name: "SAFE", role: "conservative risk reviewer" }, neutral: { name: "NEUTRAL", role: "neutral risk reviewer" }, pm: { name: "PM", role: "portfolio manager" }
};

export const analystIds: FinanceAgentId[] = ["taro", "diana", "nova", "vibe"];
export const debateIds: FinanceAgentId[] = ["bull", "bear", "bull", "bear"];
export const riskIds: FinanceAgentId[] = ["risky", "safe", "neutral"];

type AgentContext = { analystResults?: FinanceAgentResult[]; debateResults?: FinanceAgentResult[]; market: FinanceMarketSnapshot; memory?: string[]; proposedDecision?: Record<string, unknown>; riskResults?: FinanceAgentResult[] };

function formatReports(items: FinanceAgentResult[] = []) { return items.map((item) => `${item.name}: ${item.report}`).join("\n\n") || "No previous report is available."; }
function formatCandles(market: FinanceMarketSnapshot) {
  return market.candles.slice(-20).map((candle) => {
    const date = new Date(candle.t).toISOString().slice(0, 10);
    return `${date}  시가 ${candle.o}  고가 ${candle.h}  저가 ${candle.l}  종가 ${candle.c}  거래량 ${candle.v}`;
  }).join("\n") || "데이터 없음";
}

const briefingRule = "report는 8~14문장의 본격 브리핑이다. 소제목 없이 자연스러운 단락 2~3개로 쓰고, 관찰한 수치, 그 해석, 반대 시나리오와 리스크, 판단이 바뀌는 가격·레벨·이벤트를 반드시 담아라. 제공된 데이터에 없는 수치는 절대 만들지 말고, 없으면 데이터 없음이라고 밝혀라. bubble은 결론과 핵심 근거를 담은 2~3문장으로 쓴다.";
const basicOutput = '반드시 JSON 하나만 출력하라: {"bubble":"말풍선 2~3문장(한국어)","report":"상세 브리핑(한국어, 8~14문장)"}';
const decisionOutput = '반드시 JSON 하나만 출력하라: {"bubble":"말풍선 2~3문장(한국어)","report":"상세 브리핑(한국어, 8~14문장)","action":"BUY|SELL|HOLD","confidence":0,"entry":"진입가 또는 조건","stop":"손절가","target":"목표가","rationale":"근거 2~3문장"}';
const pmOutput = '반드시 JSON 하나만 출력하라: {"bubble":"말풍선 2~3문장(한국어)","report":"상세 브리핑(한국어, 8~14문장)","verdict":"APPROVE|AMEND|REJECT","action":"BUY|SELL|HOLD","confidence":0,"entry":"진입가 또는 조건","stop":"손절가","target":"목표가","sizing":"권장 비중 한 줄","rationale":"승인·수정·기각 근거 2~3문장"}';

export function buildFinanceAgentPrompt(id: FinanceAgentId, context: AgentContext) {
  const definition = definitions[id];
  const market = context.market;
  const base = [
    `너는 픽셀 트레이딩 플로어의 ${definition.name}(${definition.role})다. 아래 제공된 데이터만 사용하고 도구·검색을 쓰지 마라.`,
    "이 분석은 PAPER 모드 연구이며 실제 주문·체결·투자 조언이 아니다.",
    `[대상]\n${market.display} (${market.symbol})\n${market.priceLine}`
  ];
  if (id === "taro") base.push(`[기술 지표 요약]\n${market.indicators.summaryLines.join("\n")}\n\n[최근 20일 캔들]\n${formatCandles(market)}\n\n위 기술적 데이터를 근거로 추세·모멘텀·지지저항을 분석하라.`);
  if (id === "diana") base.push(`[기본적 데이터]\n${market.fundamentals.join("\n")}\n\n위 기본적 데이터를 근거로 밸류에이션과 펀더멘털을 분석하라.`);
  if (id === "nova") base.push(`[최신 뉴스 헤드라인]\n${market.headlines.join("\n") || "데이터 없음"}\n\n위 뉴스 흐름이 가격에 미칠 영향을 분석하라.`);
  if (id === "vibe") base.push(`[센티먼트 지표]\n${market.sentiment.join("\n")}\n\n[뉴스 제목]\n${market.headlines.join("\n") || "데이터 없음"}\n\n위 심리·여론 데이터를 근거로 투자 심리를 분석하라.`);
  if (id === "bull" || id === "bear") {
    const rival = id === "bull" ? "약세론자(BEAR)" : "강세론자(BULL)";
    const stance = id === "bull" ? "너는 강세론자(BULL)다. 위 데이터로 매수 논거를 강하게 제시하라." : "너는 약세론자(BEAR)다. 위 데이터로 매도 논거를 강하게 제시하라.";
    base.push(`[애널리스트 4인 리포트]\n${formatReports(context.analystResults)}\n\n[진행된 토론]\n${formatReports(context.debateResults)}\n\n${stance}\n가장 최근 ${rival} 발언을 구체적으로 지목해 반박하라. bubble과 report 모두에 반박 논지를 담아라.`);
  }
  if (id === "ace") base.push(`[과거 판정 회고]\n${context.memory?.join("\n") || "없음"}\n\n같은 실수를 반복하지 말되, 과거 판단에 끌려 현재 데이터를 왜곡하지 마라.\n\n[애널리스트 리포트]\n${formatReports(context.analystResults)}\n\n[전체 토론 로그]\n${formatReports(context.debateResults)}\n\n너는 수석 트레이더(ACE)다. 위 모든 분석과 토론을 종합해 1차 매매 판정을 내려라. action은 BUY, SELL, HOLD 중 하나여야 하고 confidence는 0~100 정수다.`);
  if (riskIds.includes(id)) {
    const stance = id === "risky" ? "기회를 놓치는 비용을 우선으로 보고, 지나치게 보수적이지 않은지와 감당 가능한 최대 리스크를 제시하라." : id === "safe" ? "자본 보존과 꼬리위험을 우선으로 보고, 최악의 시나리오와 비중 축소·손절·보류 중 필요한 조치를 분명히 제시하라." : "앞선 두 심사자의 주장을 직접 인용해 타당한 부분과 과장된 부분을 가르고 조건부 승인안을 제시하라.";
    base.push(`[애널리스트 리포트]\n${formatReports(context.analystResults)}\n\n[리서치 토론 로그]\n${formatReports(context.debateResults)}\n\n[수석 트레이더의 1차 계획]\n${JSON.stringify(context.proposedDecision ?? {})}\n\n[앞선 리스크 심사 의견]\n${formatReports(context.riskResults)}\n\n너는 ${definition.name}다. ${stance}`);
  }
  if (id === "pm") base.push(`[애널리스트 리포트]\n${formatReports(context.analystResults)}\n\n[리서치 토론 로그]\n${formatReports(context.debateResults)}\n\n[수석 트레이더의 1차 계획]\n${JSON.stringify(context.proposedDecision ?? {})}\n\n[리스크 위원회 심사 의견]\n${formatReports(context.riskResults)}\n\n[과거 판정 회고]\n${context.memory?.join("\n") || "없음"}\n\n너는 포트폴리오 매니저(PM)다. 리스크 위원회 의견을 종합해 계획을 APPROVE·AMEND·REJECT 중 하나로 판정한다. AMEND라면 진입·손절·목표·비중의 변경점을 rationale에 명시하라. REJECT라면 action을 HOLD로 두고 기각 사유를 밝혀라.`);
  base.push(briefingRule, id === "ace" ? decisionOutput : id === "pm" ? pmOutput : basicOutput);
  return base.join("\n\n");
}

function parseJson(raw: string) {
  const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return {} as Record<string, unknown>;
  try { return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>; } catch { return {} as Record<string, unknown>; }
}

function clippedText(value: unknown, maxLength: number, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value.trim().slice(0, maxLength);
}

export async function runFinanceAgent(id: FinanceAgentId, context: AgentContext, provider: FinanceLlmProvider, signal: AbortSignal): Promise<FinanceAgentResult & Record<string, unknown>> {
  const parsed = parseJson(await provider.generate(buildFinanceAgentPrompt(id, context), signal));
  return {
    ...parsed,
    id,
    name: definitions[id].name,
    bubble: clippedText(parsed.bubble, 700, "Analysis complete."),
    report: clippedText(parsed.report, 9000, "No detailed report was returned.")
  };
}
