"use client";

import { useEffect } from "react";

export default function WoohyukmonV4Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("WooHyukmon V4 route error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60svh] w-full max-w-3xl items-center px-5 py-10 md:px-8">
      <section className="w-full border border-white/10 bg-white/[0.035] p-6 text-center md:p-10">
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#f7c76b]">WOOHYUKMON 4.0</p>
        <h1 className="mt-4 text-2xl font-semibold text-white">This workspace could not load.</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">The rest of K_LINE remains available. Try opening this private workspace again.</p>
        <button type="button" onClick={reset} className="mt-6 h-11 rounded-lg bg-[#f7c76b] px-4 text-sm font-bold text-[#151819]">Try again</button>
      </section>
    </main>
  );
}
