import { I18nText } from "@/components/LanguageProvider";

export function HeroSection() {
  return (
    <section className="relative isolate bg-paper px-4 py-14 text-center sm:px-5 sm:py-20 md:px-8 md:py-28 lg:py-32">
      <div className="mx-auto max-w-4xl">
        <div className="inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-navy/10 bg-white/58 px-4 py-2 text-center text-xs font-bold uppercase leading-5 tracking-[0.14em] text-navy shadow-[0_10px_30px_rgba(31,42,68,0.06)]">
          <span aria-hidden className="text-brass">✦</span>
          <I18nText
            en="Korea Campus K-Culture & International Student Hub"
            ko="한국 캠퍼스 K-컬처 및 국제학생 허브"
          />
        </div>

        <h1 className="mt-6 font-serif text-5xl font-semibold tracking-[-0.04em] text-navy sm:mt-7 sm:text-6xl md:text-7xl lg:text-8xl">
          K_LINE
        </h1>

        <p className="mx-auto mt-5 max-w-3xl text-base font-medium leading-7 text-muted sm:mt-7 sm:text-lg sm:leading-8 md:text-xl">
          <I18nText
            en="K_LINE is a Korea-based campus platform connecting international students with Korean university communities, K-culture experiences, student clubs, local activities and cultural projects."
            ko="K_LINE은 외국인 유학생과 한국 대학생을 연결하고 대학 생활, K-컬처, 지역 문화, 동아리 및 다양한 한국 체험을 제공하는 캠퍼스 기반 국제교류 플랫폼입니다."
          />
        </p>
      </div>
    </section>
  );
}
