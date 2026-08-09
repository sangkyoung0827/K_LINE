import Link from "next/link";
import { ArrowRight, Bot, FlaskConical, ShieldCheck } from "lucide-react";

export default function WoohyukmonV4Page() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <p className="text-[11px] font-bold tracking-[0.16em] text-[#f7c76b]">WOOHYUKMON 4.0 / PRIVATE DEVELOPER BUILD</p>
      <h1 className="mt-3 text-4xl font-semibold text-white md:text-6xl">Developer Control Plane</h1>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-white/60">WooHyukmon 3.x remains the public production assistant. This isolated workspace prepares developer-only finance research, paper-mode controls, and future approval-gated experiments.</p>
      <div className="mt-9 grid gap-4 lg:grid-cols-3">
        <V4Card href="/v4/finance" icon={FlaskConical} title="Finance" description="Experimental finance foundation. Paper mode only; no broker connection or real order capability." />
        <V4Card href="/contact" icon={Bot} title="WooHyukmon Chat 3.x" description="Open the public production assistant without changing its existing behavior." />
        <V4Card href="/developer" icon={ShieldCheck} title="Developer Console" description="Return to K_LINE developer analytics and site management." />
      </div>
    </main>
  );
}

function V4Card({ description, href, icon: Icon, title }: { description: string; href: string; icon: typeof FlaskConical; title: string }) {
  return (
    <Link href={href} className="group border border-white/10 bg-white/[0.035] p-6 transition hover:border-[#f7c76b]/60 hover:bg-white/[0.065]">
      <Icon aria-hidden className="h-6 w-6 text-[#f7c76b]" />
      <h2 className="mt-5 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 min-h-14 text-sm leading-6 text-white/56">{description}</p>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#f7c76b]">Open <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" /></span>
    </Link>
  );
}

