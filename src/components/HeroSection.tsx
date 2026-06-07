import Image from "next/image";
import { CTAButton } from "@/components/CTAButton";
import { Logo } from "@/components/Logo";

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-navy text-paper">
      <Image
        src="/images/k-line-hero.png"
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
      <div className="relative mx-auto grid min-h-[78svh] max-w-7xl content-center px-5 py-16 md:px-8">
        <Logo variant="light" size="lg" showTagline={false} />
        <p className="mt-8 text-sm font-semibold uppercase tracking-normal text-brass">
          Campus K-Culture Hub
        </p>
        <h1 className="mt-4 font-serif text-6xl font-semibold tracking-normal text-paper md:text-8xl">
          K_LINE
        </h1>
        <p className="mt-6 max-w-3xl text-xl leading-8 text-paper/84 md:text-2xl">
          A campus platform connecting Korean cultural projects, goods, and student activities.
        </p>
        <p className="mt-4 max-w-3xl text-base leading-8 text-paper/72 md:text-lg">
          외국인 유학생과 한국 학생이 함께 만드는 대학 기반 K-컬처 플랫폼
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <CTAButton href="/k-culture-project" variant="light">
            Explore Projects
          </CTAButton>
          <CTAButton href="/our-activities" variant="lightOutline">
            View Activities
          </CTAButton>
          <CTAButton href="/goods" variant="gold">
            Shop Goods
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
