"use client";

export default function FinanceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60svh] w-full max-w-5xl items-center px-6 py-12 sm:px-10">
      <section className="w-full rounded-2xl border border-amber-300/20 bg-white/[0.035] p-7 text-[#f7f4ed] sm:p-10">
        <p className="text-xs font-bold tracking-[0.16em] text-[#f7c76b]">FINANCE UNAVAILABLE</p>
        <h1 className="mt-3 text-3xl font-bold">The Finance area needs a moment.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/62">
          This issue is contained inside WooHyukmon 4.0. K_LINE and the public WooHyukmon experience remain available.
        </p>
        <button type="button" onClick={reset} className="mt-6 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#141718] transition hover:bg-[#f7c76b]">
          Try Finance again
        </button>
      </section>
    </main>
  );
}
