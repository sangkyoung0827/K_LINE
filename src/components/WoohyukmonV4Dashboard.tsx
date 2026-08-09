"use client";

import { BarChart3, Bot, LoaderCircle, Send, ShieldCheck, WalletCards } from "lucide-react";
import type { ComponentType, FormEvent, SVGProps } from "react";
import { useEffect, useState } from "react";

type Analysis = {
  id: string; symbol: string; createdAt: string; summary: string; persistence: "saved" | "unavailable";
  marketSnapshot: { display: string; candles: Array<{ t: number; c: number }>; indicators: { summaryLines: string[] } };
  agentResults: Array<{ id: string; name: string; bubble: string; report: string; turn?: number }>;
  riskReview: Array<{ name: string; bubble: string; report: string }>;
  decision: { action: "BUY" | "SELL" | "HOLD"; confidence: number | null; entry: string; stop: string; target: string; rationale: string; sizing: string; verdict: string };
};

type Overview = { experimentalCapitalKrw: number; metrics: Array<{ key: string; label: string; value: number | null; format: string }>; mode: "PAPER" };
type ChatLine = { role: "user" | "assistant"; content: string };
type HistoryItem = Pick<Analysis, "createdAt" | "id" | "summary" | "symbol">;
type Portfolio = {
  account: { maskedNumber: string | null; sequence: number; type: string };
  asOf: string;
  totals: {
    marketValue: { krw: number; usd: number };
    profitLoss: { krw: number; usd: number; rate: number | null };
    dailyProfitLoss: { krw: number; usd: number; rate: number | null };
  };
  holdings: Array<{ symbol: string; name: string; currency: "KRW" | "USD"; quantity: number; marketValue: number; profitLoss: number; profitLossRate: number | null; allocationPercent: number | null }>;
};
type PortfolioResponse = { state: "ready" | "not_configured" | "unavailable"; message?: string; portfolio?: Portfolio };

const emptyOverview: Overview = { experimentalCapitalKrw: 100000, mode: "PAPER", metrics: [] };

function chartPath(candles: Array<{ c: number }>) {
  if (candles.length < 2) return "";
  const values = candles.map(({ c }) => c); const minimum = Math.min(...values); const maximum = Math.max(...values); const range = maximum - minimum || 1;
  return values.map((value, index) => `${index ? "L" : "M"}${(index / (values.length - 1)) * 100} ${72 - ((value - minimum) / range) * 58}`).join(" ");
}

function formatMoney(value: number, currency: "KRW" | "USD") {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency, maximumFractionDigits: currency === "KRW" ? 0 : 2 }).format(value);
}

function portfolioValue(portfolio: Portfolio | null) {
  if (!portfolio) return "—";
  const values = [];
  if (portfolio.totals.marketValue.krw) values.push(formatMoney(portfolio.totals.marketValue.krw, "KRW"));
  if (portfolio.totals.marketValue.usd) values.push(formatMoney(portfolio.totals.marketValue.usd, "USD"));
  return values.join(" + ") || formatMoney(0, "KRW");
}

function symbolFromRequest(value: string) {
  if (/엔비디아|nvidia/i.test(value)) return "NVDA";
  if (/애플|apple/i.test(value)) return "AAPL";
  if (/삼성전자/.test(value)) return "삼성전자";
  if (/SK하이닉스/i.test(value)) return "SK하이닉스";
  const match = value.match(/(?:^|\s)([A-Za-z]{1,8}|\d{6})(?=\s*(?:분석|analysis|어때|stock|주식|buy|sell|$))/i);
  return match?.[1] ?? "";
}

function analysisAnswer(message: string, analysis: Analysis | null, overview: Overview) {
  const normalized = message.toLowerCase();
  if (/계좌|자산|성과|portfolio|performance|p&l|수익/.test(normalized)) {
    return `Experiment capital is ₩${new Intl.NumberFormat("ko-KR").format(overview.experimentalCapitalKrw)}. No verified assets, positions, P&L, or performance data has been recorded yet.`;
  }
  if (!analysis) return "There is no saved analysis yet. Name a symbol, for example: NVDA 분석해줘.";
  if (/bear|위험|risk|하락|리스크/.test(normalized)) {
    const bearReports = analysis.agentResults.filter((agent) => agent.name === "BEAR").map((agent) => agent.report).join("\n\n");
    return bearReports || analysis.riskReview.map((agent) => `${agent.name}: ${agent.report}`).join("\n\n");
  }
  if (/왜|why|buy|sell|hold|판단|decision|entry|stop|target/.test(normalized)) {
    return `${analysis.symbol} final decision: ${analysis.decision.action} (${analysis.decision.confidence ?? "—"}% confidence). ${analysis.decision.rationale}\n\nEntry: ${analysis.decision.entry}\nStop: ${analysis.decision.stop}\nTarget: ${analysis.decision.target}`;
  }
  if (/최근|recent|분석|analysis/.test(normalized)) return analysis.summary;
  return "Ask about the selected analysis, its risk review, or name a symbol for a new analysis.";
}

async function readWooHyukmonStream(response: Response) {
  const payload = await response.text();
  let answer = "";
  for (const line of payload.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as { error?: string; text?: string; type?: string };
      if (event.type === "error") throw new Error(event.error || "Woohyukmon could not answer.");
      if (event.type === "text" && event.text) answer += event.text;
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
  }
  return answer.trim() || "No response was generated.";
}

export function WoohyukmonV4Dashboard({ chatOnly = false }: { chatOnly?: boolean }) {
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioState, setPortfolioState] = useState<PortfolioResponse["state"]>("not_configured");
  const [portfolioMessage, setPortfolioMessage] = useState("");
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    const [overviewResponse, historyResponse, portfolioResponse] = await Promise.all([fetch("/api/v4/finance/overview"), fetch("/api/v4/finance/history"), fetch("/api/v4/finance/portfolio")]);
    if (overviewResponse.ok) setOverview(await overviewResponse.json() as Overview);
    if (historyResponse.ok) {
      const data = await historyResponse.json() as { data?: HistoryItem[] };
      setHistory(data.data ?? []);
    }
    if (portfolioResponse.ok) {
      const data = await portfolioResponse.json() as PortfolioResponse;
      setPortfolioState(data.state);
      setPortfolio(data.portfolio ?? null);
      setPortfolioMessage(data.message ?? "");
    }
  };

  useEffect(() => { void loadData().catch(() => setError("Finance data could not load.")); }, []);

  const selectHistory = async (id: string) => {
    setError("");
    try {
      const response = await fetch(`/api/v4/finance/history?id=${encodeURIComponent(id)}`);
      const data = await response.json() as { data?: Analysis; error?: string };
      if (!response.ok || !data.data) throw new Error(data.error || "Saved analysis could not load.");
      setSelected(data.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Saved analysis could not load.");
    }
  };

  const runPortfolioProposal = async (symbol: string) => {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/v4/finance/portfolio/proposal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol }) });
      const data = await response.json() as { analysis?: Analysis; portfolio?: Portfolio; proposal?: { message?: string; positionContext?: string }; error?: string };
      if (!response.ok || !data.analysis) throw new Error(data.error || "Portfolio research could not run.");
      setSelected(data.analysis);
      if (data.portfolio) { setPortfolio(data.portfolio); setPortfolioState("ready"); }
      setHistory((current) => [{ id: data.analysis!.id, symbol: data.analysis!.symbol, createdAt: data.analysis!.createdAt, summary: data.analysis!.summary }, ...current.filter((item) => item.id !== data.analysis!.id)].slice(0, 8));
      setLines((current) => [...current, { role: "assistant", content: `${data.proposal?.positionContext ?? ""}\n\n${data.proposal?.message ?? "Manual review only."}\n\n${data.analysis!.summary}`.trim() }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Portfolio research could not run.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const message = input.trim(); if (!message || loading) return;
    setInput(""); setError(""); setLoading(true); setLines((current) => [...current, { role: "user", content: message }]);
    try {
      const symbol = symbolFromRequest(message);
      if (symbol) {
        const response = await fetch("/api/v4/finance/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol }) });
        const data = await response.json() as Analysis & { error?: string };
        if (!response.ok) throw new Error(data.error || "Finance analysis could not run.");
        setSelected(data); setHistory((current) => [{ id: data.id, symbol: data.symbol, createdAt: data.createdAt, summary: data.summary }, ...current.filter((item) => item.id !== data.id)].slice(0, 8));
        setLines((current) => [...current, { role: "assistant", content: data.summary }]);
      } else if (/계좌|자산|성과|portfolio|performance|p&l|수익|bear|위험|risk|하락|리스크|왜|why|buy|sell|hold|판단|decision|최근 분석|recent analysis/i.test(message)) {
        setLines((current) => [...current, { role: "assistant", content: analysisAnswer(message, selected, overview) }]);
      } else {
        const response = await fetch("/api/gemini", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history: lines.slice(-6) }) });
        if (!response.ok) throw new Error("Woohyukmon could not answer.");
        const answer = await readWooHyukmonStream(response);
        setLines((current) => [...current, { role: "assistant", content: answer }]);
      }
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The request could not be completed."); }
    finally { setLoading(false); }
  };

  const selectedChart = selected?.marketSnapshot.candles ?? [];

  if (chatOnly) return (
    <main className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-5xl flex-col px-5 py-8 md:px-8">
      <WorkspaceChat lines={lines} loading={loading} input={input} setInput={setInput} submit={submit} error={error} />
    </main>
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[11px] font-bold tracking-[0.16em] text-[#f7c76b]">WOOHYUKMON 4.0 / PRIVATE</p><h1 className="mt-3 text-3xl font-semibold text-white md:text-5xl">Personal Investment Workspace</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">Private, read-only portfolio data with research proposals. Every trade remains your decision in the Toss Securities app.</p></div>
        <span className="rounded-full border border-[#f7c76b]/30 bg-[#f7c76b]/10 px-3 py-1.5 text-xs font-bold text-[#f7c76b]">READ ONLY</span>
      </div>
      <section id="toss-securities" className="mt-8 scroll-mt-8">
        <Panel title="Toss Securities" icon={WalletCards}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-5 text-white/48">{portfolioState === "ready" && portfolio ? `Read-only Toss Securities data · ${portfolio.account.type} ${portfolio.account.maskedNumber ?? ""} · updated ${new Date(portfolio.asOf).toLocaleString()}` : portfolioMessage || "Toss Securities has not been connected."}</p>
            <button type="button" onClick={() => void loadData()} disabled={loading} className="h-8 border border-[#f7c76b]/45 px-3 text-xs font-bold text-[#f7c76b] transition hover:bg-[#f7c76b]/10 disabled:opacity-50">Refresh</button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Portfolio value" value={portfolioValue(portfolio)} note={portfolio ? `${portfolio.holdings.length} held positions` : "No account data"} />
            <Metric label="Total return" value={portfolio ? `${formatMoney(portfolio.totals.profitLoss.krw, "KRW")}${portfolio.totals.profitLoss.usd ? ` / ${formatMoney(portfolio.totals.profitLoss.usd, "USD")}` : ""}` : "—"} note={portfolio?.totals.profitLoss.rate != null ? `${(portfolio.totals.profitLoss.rate * 100).toFixed(2)}% reported return` : "No account data"} />
            <Metric label="Today" value={portfolio ? `${formatMoney(portfolio.totals.dailyProfitLoss.krw, "KRW")}${portfolio.totals.dailyProfitLoss.usd ? ` / ${formatMoney(portfolio.totals.dailyProfitLoss.usd, "USD")}` : ""}` : "—"} note="Broker-reported daily result" />
          </div>
          {portfolio?.holdings.length ? <div className="mt-4 divide-y divide-white/10 border-y border-white/10">{portfolio.holdings.map((holding) => <div key={`${holding.currency}-${holding.symbol}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-white">{holding.name} <span className="text-white/45">{holding.symbol}</span></p><p className="mt-1 text-xs text-white/48">{holding.quantity.toLocaleString()} shares · {holding.allocationPercent?.toFixed(1) ?? "—"}% allocation · {formatMoney(holding.marketValue, holding.currency)}</p></div><div className="flex items-center gap-3"><p className={`text-xs font-semibold ${holding.profitLoss >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{holding.profitLoss >= 0 ? "+" : ""}{formatMoney(holding.profitLoss, holding.currency)} {holding.profitLossRate !== null ? `(${(holding.profitLossRate * 100).toFixed(1)}%)` : ""}</p><button type="button" onClick={() => void runPortfolioProposal(holding.symbol)} disabled={loading} className="h-8 border border-white/20 px-3 text-xs font-bold text-white/80 transition hover:border-[#f7c76b]/60 hover:text-[#f7c76b] disabled:opacity-50">Research proposal</button></div></div>)}</div> : <Empty label={portfolioState === "ready" ? "No stock holdings were returned by the connected account." : "Add your Toss Securities server environment variables, then refresh this private dashboard."} />}
        </Panel>
      </section>
      <section id="trade-proposal" className="mt-4 grid scroll-mt-8 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <Panel title={selected ? `${selected.marketSnapshot.display} proposal chart` : "Trade proposal"} icon={BarChart3}>
          {selectedChart.length ? <svg viewBox="0 0 100 80" className="h-56 w-full overflow-visible" role="img" aria-label={`${selected?.symbol} price trend`}><path d="M0 72H100M0 42H100M0 12H100" stroke="rgba(255,255,255,.09)" strokeWidth=".4" /><path d={chartPath(selectedChart)} fill="none" stroke="#f7c76b" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg> : <Empty label="Choose a holding above to create a private research proposal." />}
          {selected ? <p className="mt-3 text-xs leading-5 text-white/42">{selected.marketSnapshot.indicators.summaryLines.slice(0, 3).join(" · ")}</p> : null}
        </Panel>
        <Panel title="Manual trade proposal" icon={ShieldCheck}>
          {selected ? <div><p className="text-4xl font-bold text-[#f7c76b]">{selected.decision.action}</p><p className="mt-2 text-sm text-white/70">Confidence {selected.decision.confidence ?? "—"}% · PM {selected.decision.verdict}</p><p className="mt-5 text-sm leading-6 text-white/68">{selected.decision.rationale}</p><dl className="mt-5 grid grid-cols-3 gap-2 text-xs"><Fact label="Entry" value={selected.decision.entry} /><Fact label="Stop" value={selected.decision.stop} /><Fact label="Target" value={selected.decision.target} /></dl><p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-white/45">No order was sent to Toss Securities. Review this research and place any order yourself in the Toss Securities app.</p></div> : <Empty label="No proposal yet. Choose a holding in Toss Securities." />}
        </Panel>
      </section>
      <section id="performance" className="mt-4 scroll-mt-8">
        <Panel title="Performance" icon={BarChart3}>
          <div className="grid gap-3 sm:grid-cols-3"><Metric label="Total P&L" value={portfolio ? `${formatMoney(portfolio.totals.profitLoss.krw, "KRW")}${portfolio.totals.profitLoss.usd ? ` / ${formatMoney(portfolio.totals.profitLoss.usd, "USD")}` : ""}` : "—"} note="Unrealized broker-reported result" /><Metric label="Daily P&L" value={portfolio ? `${formatMoney(portfolio.totals.dailyProfitLoss.krw, "KRW")}${portfolio.totals.dailyProfitLoss.usd ? ` / ${formatMoney(portfolio.totals.dailyProfitLoss.usd, "USD")}` : ""}` : "—"} note="Current account snapshot" /><Metric label="Research history" value={String(history.length)} note="Saved private analyses" /></div>
          {history.length ? <div className="mt-5 flex flex-wrap gap-2">{history.map((analysis) => <button key={analysis.id} type="button" onClick={() => void selectHistory(analysis.id)} className="border border-white/15 px-3 py-2 text-left text-xs text-white/74 transition hover:border-[#f7c76b]/60 hover:text-[#f7c76b]"><strong>{analysis.symbol}</strong><span className="ml-2 text-white/42">{new Date(analysis.createdAt).toLocaleDateString()}</span></button>)}</div> : <p className="mt-5 text-sm text-white/42">Saved research results will appear here. Realized trade history is intentionally not inferred from this read-only connection.</p>}
        </Panel>
      </section>
      <section id="chat" className="mt-4 scroll-mt-8"><WorkspaceChat lines={lines} loading={loading} input={input} setInput={setInput} submit={submit} error={error} /></section>
    </main>
  );
}

function WorkspaceChat({ error, input, lines, loading, setInput, submit }: { error: string; input: string; lines: ChatLine[]; loading: boolean; setInput: (value: string) => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <section className="border border-white/10 bg-white/[0.035] p-4 md:p-5"><div className="flex items-center gap-2"><Bot className="h-5 w-5 text-[#f7c76b]" aria-hidden /><h2 className="font-semibold text-white">Ask WooHyukmon</h2></div><div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">{lines.length ? lines.map((line, index) => <p key={`${line.role}-${index}`} className={`max-w-3xl rounded-lg px-3 py-2 text-sm leading-6 ${line.role === "user" ? "ml-auto bg-[#f7c76b] text-[#161819]" : "bg-white/[0.06] text-white/80"}`}>{line.content}</p>) : <p className="text-sm text-white/46">Ask “NVDA analysis”, “삼성전자 분석해줘”, or a general WooHyukmon question.</p>}</div><form onSubmit={submit} className="mt-4 flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#101213] px-3 text-sm text-white outline-none focus:border-[#f7c76b]" placeholder="Ask WooHyukmon..." /><button disabled={loading} className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#f7c76b] text-[#151819] disabled:opacity-50" aria-label="Send">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></form>{error ? <p className="mt-3 text-xs text-rose-200">{error}</p> : null}</section>;
}
function Panel({ children, icon: Icon, title }: { children: React.ReactNode; icon: ComponentType<SVGProps<SVGSVGElement>>; title: string }) { return <section className="border border-white/10 bg-white/[0.035] p-5"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#f7c76b]" aria-hidden /><h2 className="text-sm font-bold text-white">{title}</h2></div><div className="mt-5">{children}</div></section>; }
function Metric({ label, note, value }: { label: string; note: string; value: string }) { return <section className="border border-white/10 bg-white/[0.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</p><p className="mt-3 text-2xl font-semibold text-white">{value}</p><p className="mt-2 text-xs text-white/42">{note}</p></section>; }
function Empty({ label }: { label: string }) { return <p className="flex min-h-24 items-center text-sm text-white/42">{label}</p>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt className="text-white/40">{label}</dt><dd className="mt-1 truncate text-white/75" title={value}>{value}</dd></div>; }
