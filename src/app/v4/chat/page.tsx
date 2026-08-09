import Link from "next/link";
import { ArrowUpRight, LockKeyhole, MessageSquareText } from "lucide-react";

export default function WoohyukmonV4ChatPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10 lg:px-14">
      <p className="text-xs font-bold tracking-[0.16em] text-[#f7c76b]">WOOHYUKMON 4.0 / PRIVATE CHAT</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Developer Chat</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/64">
        WooHyukmon 4.0 uses the existing WooHyukmon 3.x conversation experience while private finance and operational tools are introduced in controlled phases.
      </p>

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f7c76b]/10 text-[#f7c76b]">
          <MessageSquareText className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="mt-5 text-xl font-bold text-white">WooHyukmon Chat 3.x</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
          The public assistant remains the active chat surface. Finance data, order execution, and private developer records are not exposed to that public surface.
        </p>
        <Link
          href="/contact"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#151819] transition hover:bg-[#f7c76b]"
        >
          Open WooHyukmon Chat 3.x
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>

      <p className="mt-6 flex items-center gap-2 text-xs text-white/42">
        <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
        This route is server-authorized for developer accounts only.
      </p>
    </main>
  );
}
