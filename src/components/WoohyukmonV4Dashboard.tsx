"use client";

import { Activity, BarChart3, Bot, BrainCircuit, LoaderCircle, Send, ShieldCheck } from "lucide-react";
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

const emptyOverview: Overview = { experimentalCapitalKrw: 100000, mode: "PAPER", metrics: [] };

function chartPath(candles: Array<{ c: number }>) {
  if (candles.length < 2) return "";
  const values = candles.map(({ c }) => c); const minimum = Math.min(...values); const maximum = Math.max(...values); const range = maximum - minimum || 1;
  return values.map((value, index) => `${index ? "L" : "M"}${(index / (values.length - 1)) * 100} ${72 - ((value - minimum) / range) * 58}`).join(" ");
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
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    const [overviewResponse, historyResponse] = await Promise.all([fetch("/api/v4/finance/overview"), fetch("/api/v4/finance/history")]);
    if (overviewResponse.ok) setOverview(await overviewResponse.json() as Overview);
    if (historyResponse.ok) {
      const data = await historyResponse.json() as { data?: HistoryItem[] };
      setHistory(data.data ?? []);
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
  const analysisAgents = selected?.agentResults ?? [];
  const mainAgents = analysisAgents.filter((agent) => ["TARO", "DIANA", "NOVA", "VIBE"].includes(agent.name));

  if (chatOnly) return (
    <main className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-5xl flex-col px-5 py-8 md:px-8">
      <WorkspaceChat lines={lines} loading={loading} input={input} setInput={setInput} submit={submit} error={error} />
    </main>
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[11px] font-bold tracking-[0.16em] text-[#f7c76b]">WOOHYUKMON 4.0 / DASHBOARD</p><h1 className="mt-3 text-3xl font-semibold text-white md:text-5xl">Interactive Finance Workspace</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">Source-based multi-agent research in Paper mode. This workspace never places orders and is not investment advice.</p></div>
        <span className="rounded-full border border-[#f7c76b]/30 bg-[#f7c76b]/10 px-3 py-1.5 text-xs font-bold text-[#f7c76b]">EXPERIMENTAL / PAPER</span>
      </div>
      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total Assets" value="—" note="No data yet" /><Metric label="Experiment Capital" value={`₩${new Intl.NumberFormat("ko-KR").format(overview.experimentalCapitalKrw)}`} note="Configured research baseline" /><Metric label="Today P&L" value="—" note="No data yet" /><Metric label="Portfolio Value" value="—" note="No data yet" />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
        <Panel title={selected ? `${selected.marketSnapshot.display} market chart` : "Portfolio / market chart"} icon={BarChart3}>
          {selectedChart.length ? <svg viewBox="0 0 100 80" className="h-56 w-full overflow-visible" role="img" aria-label={`${selected?.symbol} price trend`}><path d="M0 72H100M0 42H100M0 12H100" stroke="rgba(255,255,255,.09)" strokeWidth=".4" /><path d={chartPath(selectedChart)} fill="none" stroke="#f7c76b" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg> : <Empty label="No market analysis selected yet." />}
          {selected ? <p className="mt-2 text-xs text-white/42">{selected.marketSnapshot.indicators.summaryLines.slice(0, 2).join(" | ")}</p> : null}
        </Panel>
        <Panel title="Final decision" icon={BrainCircuit}>
          {selected ? <div><p className="text-4xl font-bold text-[#f7c76b]">{selected.decision.action}</p><p className="mt-2 text-sm text-white/70">Confidence {selected.decision.confidence ?? "—"}% · PM {selected.decision.verdict}</p><p className="mt-5 text-sm leading-6 text-white/62">{selected.decision.rationale}</p><dl className="mt-5 grid grid-cols-3 gap-2 text-xs"><Fact label="Entry" value={selected.decision.entry} /><Fact label="Stop" value={selected.decision.stop} /><Fact label="Target" value={selected.decision.target} /></dl></div> : <Empty label="No decision has been generated." />}
        </Panel>
      </section>
      <section className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Panel title="AI analysis" icon={Bot}>{mainAgents.length ? <div className="grid gap-2">{mainAgents.map((agent) => <button type="button" key={agent.id} onClick={() => setLines((current) => [...current, { role: "assistant", content: `${agent.name}: ${agent.report}` }])} className="border border-white/10 bg-black/10 p-3 text-left transition hover:border-[#f7c76b]/50"><span className="text-xs font-bold text-[#f7c76b]">{agent.name}</span><p className="mt-1 line-clamp-2 text-xs leading-5 text-white/64">{agent.bubble}</p></button>)}</div> : <Empty label="Agent views appear after analysis." />}</Panel>
        <Panel title="Bull / bear debate" icon={BrainCircuit}>{analysisAgents.filter((agent) => agent.name === "BULL" || agent.name === "BEAR").length ? <div className="grid gap-2">{analysisAgents.filter((agent) => agent.name === "BULL" || agent.name === "BEAR").map((agent) => <button type="button" key={`${agent.id}-${agent.turn ?? 0}`} onClick={() => setLines((current) => [...current, { role: "assistant", content: `${agent.name} turn ${agent.turn ?? ""}: ${agent.report}` }])} className="border border-white/10 bg-black/10 p-3 text-left transition hover:border-[#f7c76b]/50"><span className="text-xs font-bold text-[#f7c76b]">{agent.name} / TURN {agent.turn ?? "—"}</span><p className="mt-1 line-clamp-2 text-xs leading-5 text-white/64">{agent.bubble}</p></button>)}</div> : <Empty label="Debate appears after analysis." />}</Panel>
        <Panel title="Risk review" icon={ShieldCheck}>{selected?.riskReview.length ? <div className="grid gap-2">{selected.riskReview.map((agent) => <div key={agent.name} className="border border-white/10 bg-black/10 p-3"><p className="text-xs font-bold text-[#f7c76b]">{agent.name}</p><p className="mt-1 text-xs leading-5 text-white/62">{agent.bubble}</p></div>)}</div> : <Empty label="No risk review yet." />}</Panel>
        <Panel title="Recent analysis" icon={Activity}>{history.length ? <div className="grid gap-2">{history.map((analysis) => <button key={analysis.id} type="button" onClick={() => void selectHistory(analysis.id)} className="flex items-center justify-between border border-white/10 bg-black/10 p-3 text-left transition hover:border-[#f7c76b]/50"><span><strong className="text-sm text-white">{analysis.symbol}</strong><span className="ml-2 line-clamp-1 text-xs text-white/44">{analysis.summary}</span></span><span className="text-xs text-white/42">{new Date(analysis.createdAt).toLocaleDateString()}</span></button>)}</div> : <Empty label="Analysis history is empty." />}</Panel>
      </section>
      <section className="mt-4"><WorkspaceChat lines={lines} loading={loading} input={input} setInput={setInput} submit={submit} error={error} /></section>
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
