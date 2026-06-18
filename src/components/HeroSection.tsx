import Image from "next/image";
import { HeroActions } from "@/components/HeroActions";
import { HomeFeedbackCloud } from "@/components/HomeFeedbackCloud";
import { I18nText } from "@/components/LanguageProvider";
import { Logo } from "@/components/Logo";

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-navy text-paper">
      <Image
        src="/images/k-line-hero.jpg"
        alt="K_LINE campus K-culture platform visual"
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-[0.42]"
      />
      <div className="absolute inset-0 bg-navy/72" aria-hidden />
      <div
        className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-paper to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto grid min-h-[78svh] max-w-7xl items-center gap-10 px-5 py-16 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_430px]">
        <div>
          <Logo variant="light" size="lg" showTagline={false} />
          <p className="mt-8 text-sm font-semibold uppercase tracking-normal text-brass">
            <I18nText en="Campus K-Culture Hub" ko="캠퍼스 K-컬처 허브" />
          </p>
          <h1 className="mt-4 font-serif text-6xl font-semibold tracking-normal text-paper md:text-8xl">
            K_LINE
          </h1>
          <p className="mt-6 max-w-3xl text-xl leading-8 text-paper/84 md:text-2xl">
            <I18nText
              en="A campus platform connecting Korean cultural projects, goods, and international student clubs."
              ko="한국 문화 프로젝트, 상품, 국제 학생 클럽을 연결하는 대학 기반 플랫폼입니다."
            />
          </p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-paper/72 md:text-lg">
            <I18nText
              en="Built for international students, Korean students, and campus communities."
              ko="외국인 유학생과 한국 학생이 함께 만드는 대학 기반 K-컬처 플랫폼"
            />
          </p>
          <HeroActions />
        </div>
        <div className="lg:justify-self-end">
          <HomeFeedbackCloud />
        </div>
      </div>
    </section>
  );
}
