import { I18nText } from "@/components/LanguageProvider";

export function HeroSection() {
  return (
    <section className="relative isolate bg-paper px-5 py-20 text-center md:px-8 md:py-28 lg:py-32">
      <div className="mx-auto max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white/58 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-navy shadow-[0_10px_30px_rgba(31,42,68,0.06)]">
          <span aria-hidden className="text-brass">✦</span>
          <I18nText en="Campus K-Culture Hub" ko="Campus K-Culture Hub" />
        </div>

        <h1 className="mt-7 font-serif text-6xl font-semibold tracking-[-0.04em] text-navy md:text-7xl lg:text-8xl">
          K_LINE
        </h1>

        <p className="mx-auto mt-7 max-w-3xl text-lg font-medium leading-8 text-muted md:text-xl">
          <I18nText
            en="A hub connecting global campus communities and K-culture experiences."
            ko="캠퍼스 내 글로벌 커뮤니티와 K-컬처 경험을 연결하는 허브입니다."
          />
        </p>
      </div>
    </section>
  );
}
