export default function WoohyukmonV4Page() {
  return (
    <main className="mx-auto flex min-h-[70svh] w-full max-w-3xl items-center px-5 py-10 md:px-8">
      <section className="w-full border border-white/10 bg-white/[0.035] p-6 text-center md:p-10">
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#f7c76b]">WOOHYUKMON 4.0 / SAFE MODE</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Developer workspace is temporarily isolated.</h1>
        <p className="mt-4 text-sm leading-7 text-white/60">
          The WooHyukmon 4.0 client dashboard, finance auto-loading, history loading, charts, and agent rendering are disabled while a Chrome browser-process crash is being isolated.
        </p>
        <p className="mt-3 text-xs leading-6 text-white/40">
          No finance engine request is executed from this page in Safe Mode.
        </p>
      </section>
    </main>
  );
}
