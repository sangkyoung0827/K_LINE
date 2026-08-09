import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, Bot, BrainCircuit, FlaskConical, LayoutDashboard, LineChart, NotebookTabs, WalletCards } from "lucide-react";

const financeLinks = [
  { href: "/v4/finance", label: "Overview", icon: LayoutDashboard },
  { href: "/v4/finance/assets", label: "Assets", icon: WalletCards },
  { href: "/v4/finance/trading-lab", label: "Trading Lab", icon: FlaskConical },
  { href: "/v4/finance/paper-trading", label: "Paper Trading", icon: BarChart3 },
  { href: "/v4/finance/live-experiment", label: "Live Experiment", icon: BrainCircuit },
  { href: "/v4/finance/journal", label: "Trading Journal", icon: NotebookTabs },
  { href: "/v4/finance/performance", label: "Performance", icon: LineChart }
];

export function WoohyukmonV4Shell({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-[calc(100svh-5rem)] bg-[#121517] text-[#f7f4ed]">
      <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-[1720px] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#171b1d] p-5 lg:border-b-0 lg:border-r">
          <Link href="/v4" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#101112] text-[#f7c76b]" aria-hidden>
              <Bot className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-wide">WOOHYUKMON 4.0</span>
              <span className="mt-1 block text-[10px] font-semibold tracking-[0.14em] text-[#f7c76b]">PRIVATE DEVELOPER BUILD</span>
            </span>
          </Link>

          <nav className="mt-7 grid gap-1" aria-label="WooHyukmon 4.0 navigation">
            <Link href="/v4" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/76 transition hover:bg-white/8 hover:text-white">
              Dashboard
            </Link>
            <Link href="/v4/chat" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/76 transition hover:bg-white/8 hover:text-white">
              Developer Chat
            </Link>
          </nav>

          <div className="mt-8">
            <div className="flex items-center justify-between px-3">
              <p className="text-[10px] font-bold tracking-[0.16em] text-white/38">FINANCE</p>
              <span className="rounded-full border border-[#f7c76b]/30 bg-[#f7c76b]/10 px-2 py-0.5 text-[9px] font-bold text-[#f7c76b]">EXPERIMENTAL</span>
            </div>
            <nav className="mt-2 grid gap-1" aria-label="Finance navigation">
              {financeLinks.map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/8 hover:text-white">
                  <Icon aria-hidden className="h-4 w-4 text-[#f7c76b]" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 bg-[#121517]">{children}</div>
      </div>
    </section>
  );
}
