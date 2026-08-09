"use client";

import { BarChart3, FlaskConical, ShieldCheck, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

type FinancePage = "assets" | "journal" | "live" | "overview" | "paper" | "performance" | "trading-lab";
type Overview = {
  experimentalCapitalKrw: number;
  metrics: Array<{ key: string; label: string; value: number | null; format: string }>;
  mode: "PAPER" | "LIVE";
  state: "empty";
};

const emptyOverview: Overview = {
  experimentalCapitalKrw: 100000,
  mode: "PAPER",
  state: "empty",
  metrics: []
};

function formatMetric(value: number | null, format: string) {
  if (value === null) return "—";
  if (format === "currency") return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
  if (format === "percent") return `${value.toFixed(2)}%`;
  return String(value);
}

const pageCopy: Record<Exclude<FinancePage, "overview" | "trading-lab">, { title: string; description: string }> = {
  assets: { title: "Assets", description: "Cash, stocks, ETFs, crypto, and portfolio allocations will appear here after a connected data source is approved." },
  paper: { title: "Paper Trading", description: "Paper mode is the default. Order execution is intentionally disabled in Phase 1, so this area records no simulated fills yet." },
  live: { title: "Live Experiment", description: "A future developer-approved small-capital experiment. Live broker access and all real-money actions are disabled." },
  journal: { title: "Trading Journal", description: "Market snapshots, agent reasoning, risk review, trade proposals, and outcomes will be recorded here without mixing PAPER and LIVE results." },
  performance: { title: "Performance", description: "Return, drawdown, win rate, profit factor, strategy comparisons, and agent contribution remain empty until verified trade data exists." }
};

export function WoohyukmonV4Finance({ page }: { page: FinancePage }) {
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [symbol, setSymbol] = useState("NVDA");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/v4/finance/overview")
      .then(async (response) => {
        if (!response.ok) throw new Error("Finance overview could not load.");
        return response.json() as Promise<Overview>;
      })
      .then(setOverview)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Finance overview could not load."));
  }, []);

  const request = async (path: "analyze" | "paper-trade") => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v4/finance/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol })
      });
      const data = (await response.json()) as { message?: string; summary?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Finance request could not be completed.");
      setMessage(data.summary || data.message || "No data yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Finance request could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  if (page === "trading-lab") {
    return (
      <FinanceFrame eyebrow="FINANCE / TRADING LAB" title="Trading Lab" description="A developer-only research workspace. No decision is shown as market analysis until a verified market-data engine is connected.">
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5 md:p-7">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-semibold text-white/75">
              Symbol
              <input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12))} className="h-11 w-44 rounded-lg border border-white/15 bg-[#0f1112] px-3 text-white outline-none focus:border-[#f7c76b]" />
            </label>
            <button type="button" disabled={loading || !symbol} onClick={() => void request("analyze")} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#f7c76b] px-4 text-sm font-bold text-[#161819] transition hover:bg-white disabled:opacity-50">
              <FlaskConical aria-hidden className="h-4 w-4" />
              Analyze
            </button>
          </div>
          <div className="mt-7 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-lg border border-[#f7c76b]/25 bg-[#f7c76b]/[0.06] p-5">
              <p className="text-[10px] font-bold tracking-[0.16em] text-[#f7c76b]">MOCK / DEV</p>
              <p className="mt-3 text-sm font-semibold text-white/82">FINAL DECISION</p>
              <p className="mt-2 text-4xl font-semibold text-white">—</p>
              <p className="mt-3 text-sm leading-6 text-white/56">No verified market data. No BUY, SELL, or HOLD decision is generated.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {["Technical", "Fundamental", "News", "Sentiment", "Bull Case", "Bear Case", "Risk", "Portfolio Manager"].map((item) => (
                <div key={item} className="border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-sm font-semibold text-white/78">{item}</p>
                  <p className="mt-2 text-sm text-white/42">No data yet</p>
                </div>
              ))}
            </div>
          </div>
          {message ? <p className="mt-5 text-sm leading-6 text-[#f7c76b]">{message}</p> : null}
        </div>
      </FinanceFrame>
    );
  }

  if (page !== "overview") {
    const copy = pageCopy[page];
    const isPaper = page === "paper";
    return (
      <FinanceFrame eyebrow={`FINANCE / ${copy.title.toUpperCase()}`} title={copy.title} description={copy.description}>
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-6 md:p-8">
          <p className="text-[10px] font-bold tracking-[0.16em] text-[#f7c76b]">{page === "live" ? "DISABLED / NO BROKER CONNECTION" : "EMPTY STATE / VERIFIED DATA REQUIRED"}</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">No data yet</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">{copy.description}</p>
          {isPaper ? (
            <div className="mt-6 flex flex-wrap items-end gap-3">
              <label className="grid gap-2 text-sm font-semibold text-white/75">Symbol
                <input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12))} className="h-11 w-44 rounded-lg border border-white/15 bg-[#0f1112] px-3 text-white outline-none focus:border-[#f7c76b]" />
              </label>
              <button type="button" disabled={loading || !symbol} onClick={() => void request("paper-trade")} className="h-11 rounded-lg border border-[#f7c76b]/50 px-4 text-sm font-bold text-[#f7c76b] transition hover:bg-[#f7c76b]/10 disabled:opacity-50">Create proposal</button>
            </div>
          ) : null}
          {message ? <p className="mt-5 text-sm leading-6 text-[#f7c76b]">{message}</p> : null}
        </div>
      </FinanceFrame>
    );
  }

  return (
    <FinanceFrame eyebrow="FINANCE / OVERVIEW" title="Finance Control Plane" description="Paper-mode finance foundation for research, risk controls, strategy versioning, and future developer-approved experiments.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.metrics.map((metric) => (
          <div key={metric.key} className="border border-white/10 bg-white/[0.035] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/46">{metric.label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{formatMetric(metric.value, metric.format)}</p>
            <p className="mt-2 text-xs text-white/42">No data yet</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <StatusCard icon={WalletCards} title="Experiment Capital" value={`₩${new Intl.NumberFormat("ko-KR").format(overview.experimentalCapitalKrw)}`} note="Configured baseline only. No account is connected." />
        <StatusCard icon={BarChart3} title="Trading Mode" value={overview.mode} note="Paper is the only enabled mode." />
        <StatusCard icon={ShieldCheck} title="Risk Engine" value="RULE BASED" note="Position sizing and risk rules are separated from AI." />
      </div>
      {message ? <p className="mt-5 text-sm text-[#f7c76b]">{message}</p> : null}
    </FinanceFrame>
  );
}

function FinanceFrame({ children, description, eyebrow, title }: { children: React.ReactNode; description: string; eyebrow: string; title: string }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#f7c76b]">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold text-white md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">{description}</p>
        </div>
        <span className="rounded-full border border-[#f7c76b]/30 bg-[#f7c76b]/10 px-3 py-1.5 text-xs font-bold text-[#f7c76b]">EXPERIMENTAL</span>
      </div>
      <div className="mt-8">{children}</div>
    </main>
  );
}

function StatusCard({ icon: Icon, note, title, value }: { icon: typeof WalletCards; note: string; title: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.035] p-5">
      <Icon aria-hidden className="h-5 w-5 text-[#f7c76b]" />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/46">{title}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-white/42">{note}</p>
    </div>
  );
}
