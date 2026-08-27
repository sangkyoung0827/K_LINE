import { I18nText } from "@/components/LanguageProvider";

export function HeroSection() {
  return (
    <section className="relative isolate flex min-h-[360px] items-center justify-center bg-paper px-4 py-14 text-center sm:min-h-[430px] sm:px-5 sm:py-20 md:min-h-[500px] md:px-8 md:py-28 lg:py-32">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-serif text-5xl font-semibold tracking-[-0.04em] text-navy sm:text-6xl md:text-7xl lg:text-8xl">
          K_LINE
        </h1>
      </div>

      <div className="absolute inset-x-4 bottom-7 mx-auto max-w-3xl text-muted sm:inset-x-5 sm:bottom-9 md:inset-x-8 md:bottom-11">
        <p className="text-[10px] font-semibold leading-5 text-navy/58 sm:text-xs">
          <span aria-hidden className="mr-1 text-brass">✦</span>
          <I18nText
            en="Korea Campus K-Culture & International Student Hub"
            ko="한국 캠퍼스 K-컬처 및 국제학생 허브"
          />
        </p>
        <p className="mx-auto mt-1.5 max-w-3xl text-[11px] leading-5 text-muted/78 sm:text-xs sm:leading-6">
          <I18nText
            en="K_LINE is a Korea-based campus platform connecting international students with Korean university communities, K-culture experiences, student clubs, local activities and cultural projects."
            ko="K_LINE은 외국인 유학생과 한국 대학생을 연결하고 대학 생활, K-컬처, 지역 문화, 동아리 및 다양한 한국 체험을 제공하는 캠퍼스 기반 국제교류 플랫폼입니다."
          />
        </p>
      </div>
    </section>
  );
}
