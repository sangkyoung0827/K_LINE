import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Instagram,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { HanhwalSolbamChat } from "@/components/HanhwalSolbamChat";
import { I18nText } from "@/components/LanguageProvider";
import { hanhwalFacts, hanhwalSafetyRules } from "@/lib/hanhwalPublic";
import { absoluteUrl, createPublicMetadata } from "@/lib/seo";

const description =
  "Hanhwal (한활) is a Korean traditional archery club for international students in Jeonju. Explore weekly practice, Korean archery equipment, safety, activities, and membership.";

export const metadata: Metadata = createPublicMetadata({
  title: "Hanhwal 한활 | Korean Traditional Archery Club",
  description,
  path: "/our-activities/hanhwal",
  image: "/images/hanhwal-site/hero.webp",
  imageAlt: "Hanhwal members practicing Korean traditional archery in Jeonju",
  keywords: [
    "Hanhwal",
    "한활",
    "Korean traditional archery club",
    "국궁 동아리",
    "international student club Jeonju",
    "Jeonbuk National University archery",
    "전북대학교 국궁",
    "Jeonju international students"
  ]
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SportsOrganization",
  name: "Hanhwal",
  alternateName: "한활",
  url: absoluteUrl("/our-activities/hanhwal"),
  foundingDate: "2023-05-12",
  description,
  sport: "Korean traditional archery",
  sameAs: [hanhwalFacts.instagram],
  areaServed: { "@type": "City", name: "Jeonju" },
  location: {
    "@type": "Place",
    name: "보조구장 (Auxiliary Field)",
    address: {
      "@type": "PostalAddress",
      streetAddress: "건지로 20",
      addressLocality: "전주시 덕진구",
      addressRegion: "전북특별자치도",
      addressCountry: "KR"
    }
  }
};

const navItems = [
  { href: "#about", label: "About" },
  { href: "#practice", label: "Practice" },
  { href: "#gallery", label: "Gallery" },
  { href: "#solbam", label: "Solbam" },
  { href: "#join", label: "Join" }
] as const;

export default function HanhwalHubPage() {
  return (
    <div className="bg-white text-[#0b2342]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="Hanhwal page navigation" className="sticky top-16 z-30 border-b border-[#0b2342]/10 bg-white/95 backdrop-blur md:top-20">
        <div className="mx-auto flex max-w-[1250px] items-center justify-between gap-4 overflow-x-auto px-5 py-3 md:px-8">
          <a href="#top" className="shrink-0 text-lg font-extrabold tracking-tight text-[#0b2342]">
            <span aria-hidden>🏹</span> 한활 <span className="font-semibold text-[#526782]">Hanhwal</span>
          </a>
          <div className="flex shrink-0 items-center gap-5 text-sm font-semibold text-[#526782] md:gap-7">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-[#0b2342]">{item.label}</a>
            ))}
          </div>
        </div>
      </nav>

      <section id="top" className="relative isolate min-h-[610px] overflow-hidden scroll-mt-36 sm:min-h-[690px]">
        <Image src="/images/hanhwal-site/hero.webp" alt="Hanhwal members practicing Korean traditional archery at the auxiliary field" fill priority sizes="100vw" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#051932]/90 via-[#051932]/52 to-[#051932]/10" />
        <div className="relative mx-auto flex min-h-[610px] max-w-[1250px] items-end px-5 pb-20 pt-24 text-white sm:min-h-[690px] sm:pb-24 md:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase leading-6 tracking-[0.3em] text-white/90 sm:text-sm">Korean traditional archery club<br />for international students</p>
            <h1 className="mt-5 font-serif text-6xl font-semibold tracking-[-0.055em] sm:text-8xl md:text-[7.5rem]">Hanhwal</h1>
            <p lang="ko" className="mt-1 font-serif text-2xl text-white/90 sm:text-3xl">한활 · 한국 전통 국궁 동아리</p>
            <p className="mt-6 text-lg text-white/85 sm:text-xl">Jeonju · Jeonbuk National University community</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/hanhwal-join" className="inline-flex min-h-12 items-center gap-2 bg-white px-6 text-sm font-bold text-[#0b2342] transition hover:-translate-y-0.5 hover:bg-[#eaf0f7]">
                <I18nText en="Join Hanhwal" ko="한활 가입하기" /><ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <Link href="/hanhwal-official" className="inline-flex min-h-12 items-center border border-white/55 bg-white/10 px-6 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">Hanhwal OFFICIAL</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-36 py-20 sm:py-28">
        <div className="mx-auto grid max-w-[1250px] gap-14 px-5 md:px-8 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.34em] text-[#163c68]">Welcome</p>
            <h2 className="mt-5 font-serif text-4xl font-semibold tracking-tight sm:text-6xl">Welcome to Hanhwal</h2>
            <p className="mt-8 text-xl leading-9 text-[#0b2342]">Hanhwal (한활) is a Korean traditional archery club created for international students and everyone interested in Korean archery culture.</p>
            <p lang="ko" className="mt-5 text-base leading-8 text-[#526782]">한활은 국궁을 배우고 연습하며, 한국 전통 활쏘기의 가치를 함께 이어가는 따뜻한 공동체입니다.</p>
            <p className="mt-5 text-base leading-8 text-[#526782]">We learn, practice, and preserve the tradition of Korean archery while building a welcoming community together. Hanhwal was founded on May 12, 2023.</p>
            <a href={hanhwalFacts.instagram} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex min-h-12 items-center gap-2 bg-[#0b2342] px-6 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#163c68]">
              <Instagram aria-hidden className="h-4 w-4" />Visit @jbnu_hanhwal
            </a>
          </div>
          <div className="grid content-start gap-4 sm:grid-cols-2">
            <FactCard icon={CalendarDays} eyebrow="Founded" value="May 12, 2023" />
            <FactCard icon={Users} eyebrow="Community" value="International students" />
            <FactCard icon={Sparkles} eyebrow="Mascot" value="Solbam · 설밤 🐆" />
            <FactCard icon={ShieldCheck} eyebrow="Values" value="Safety · Respect · Community" />
          </div>
        </div>
      </section>

      <section id="practice" className="scroll-mt-36 bg-[#f3f6fa] py-20 sm:py-28">
        <div className="mx-auto max-w-[1250px] px-5 md:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.34em] text-[#163c68]">Practice with us</p>
          <h2 className="mt-5 font-serif text-4xl font-semibold tracking-tight sm:text-6xl">Find us on the field.</h2>
          <div className="mt-12 grid overflow-hidden bg-white shadow-[0_24px_70px_rgba(11,35,66,0.1)] lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid min-h-[430px] grid-cols-2 gap-1 bg-[#dfe7f0] p-1">
              <div className="relative overflow-hidden"><Image src="/images/hanhwal-site/field-1.webp" alt="Hanhwal auxiliary archery field" fill sizes="(max-width: 1024px) 50vw, 30vw" className="object-cover" /></div>
              <div className="relative overflow-hidden"><Image src="/images/hanhwal-site/field-2.webp" alt="Hanhwal practice at the auxiliary field" fill sizes="(max-width: 1024px) 50vw, 30vw" className="object-cover" /></div>
            </div>
            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
              <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#163c68]">Practice location</p>
              <h3 className="mt-5 font-serif text-4xl font-semibold">보조구장</h3>
              <p className="mt-2 text-lg text-[#526782]">Auxiliary Field</p>
              <div className="mt-8 space-y-6">
                <LocationDetail icon={MapPin} title="Address" detail="전북 전주시 덕진구 건지로 20" />
                <LocationDetail icon={Clock3} title="Weekly practice" detail="Every Saturday · 10:00 AM–12:00 PM" />
              </div>
              <a href={hanhwalFacts.map} target="_blank" rel="noopener noreferrer" className="mt-9 inline-flex min-h-12 w-fit items-center gap-2 bg-[#0b2342] px-6 text-sm font-bold text-white transition hover:bg-[#163c68]">Open in Naver Map <ArrowRight aria-hidden className="h-4 w-4" /></a>
            </div>
          </div>
        </div>
      </section>

      <section id="gallery" className="scroll-mt-36 py-20 sm:py-28">
        <div className="mx-auto max-w-[1250px] px-5 md:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.34em] text-[#163c68]">Hanhwal gallery</p><h2 className="mt-5 max-w-3xl font-serif text-4xl font-semibold tracking-tight sm:text-6xl">Moments on and off the field.</h2></div>
            <a href={hanhwalFacts.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-fit items-center gap-2 border border-[#0b2342] px-5 text-sm font-bold transition hover:bg-[#0b2342] hover:text-white">More on Instagram <ArrowRight aria-hidden className="h-4 w-4" /></a>
          </div>
          <div className="mt-12 grid auto-rows-[230px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <GalleryImage src="/images/hanhwal-site/hero.webp" alt="Hanhwal traditional archery practice" className="sm:row-span-2 lg:col-span-2" sizes="(max-width: 1024px) 100vw, 66vw" />
            <GalleryImage src="/images/hanhwal-site/news.webp" alt="Hanhwal club activity memory" sizes="(max-width: 1024px) 100vw, 33vw" />
            <GalleryImage src="/images/hanhwal-site/field-2.webp" alt="Hanhwal member at the practice field" sizes="(max-width: 1024px) 100vw, 33vw" />
          </div>
        </div>
      </section>

      <section className="bg-[#0b2342] py-20 text-white sm:py-28">
        <div className="mx-auto max-w-[1250px] px-5 md:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.34em] text-[#b8c7d9]">Equipment & etiquette</p><h2 className="mt-5 font-serif text-4xl font-semibold tracking-tight sm:text-6xl">Learn the bow. Respect the field.</h2><p className="mt-7 max-w-xl text-base leading-8 text-white/70">Members learn Korean bows and arrows, shooting posture, terminology, equipment care, and field etiquette under instructor guidance.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <EquipmentCard src="/images/hanhwal-site/single-bow.webp" alt="Korean traditional single bow" title="Korean Traditional Bow" detail="Single bows and the composite gakgung (각궁) are part of Korean archery tradition." />
              <EquipmentCard src="/images/hanhwal-site/arrows.webp" alt="Korean traditional archery arrows" title="Arrows & Accessories" detail="Learn about arrows, the thumb-protecting kkakji (깍지), and the gungdae (궁대)." />
            </div>
          </div>
          <div className="mt-16 border-t border-white/15 pt-12">
            <div className="flex items-center gap-3"><ShieldCheck aria-hidden className="h-6 w-6 text-[#b8c7d9]" /><h3 className="font-serif text-3xl font-semibold">Essential field safety</h3></div>
            <ol className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2">
              {hanhwalSafetyRules.map((rule, index) => <li key={rule} className="flex gap-4 text-sm leading-7 text-white/76"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 text-xs font-bold text-white">{index + 1}</span><span>{rule}</span></li>)}
            </ol>
            <p className="mt-8 text-sm text-[#b8c7d9]">Always follow the instructor&apos;s directions during practice.</p>
          </div>
        </div>
      </section>

      <section id="solbam" className="scroll-mt-36 bg-[#f3f6fa] py-20 sm:py-28"><div className="mx-auto max-w-[1250px] px-5 md:px-8"><HanhwalSolbamChat /></div></section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-[1250px] px-5 md:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.34em] text-[#163c68]">Latest activity</p><h2 className="mt-5 font-serif text-4xl font-semibold tracking-tight sm:text-6xl">What we&apos;ve been up to.</h2></div>
            <Link href="/our-activities/han-hwal-korean-archery-experience-international-students" className="inline-flex min-h-11 w-fit items-center gap-2 border border-[#0b2342] px-5 text-sm font-bold transition hover:bg-[#0b2342] hover:text-white">Read activity story <ArrowRight aria-hidden className="h-4 w-4" /></Link>
          </div>
          <article className="mt-12 grid overflow-hidden border border-[#0b2342]/10 bg-[#f7f9fc] lg:grid-cols-[0.78fr_1.22fr]">
            <div className="relative min-h-[330px]"><Image src="/images/hanhwal-site/news.webp" alt="Hanhwal Korean archery activity" fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" /></div>
            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14"><p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#526782]">Activity log · Korean traditional archery</p><h3 className="mt-5 font-serif text-3xl font-semibold leading-tight sm:text-4xl">Korean Archery Experience with International Students</h3><p className="mt-5 max-w-2xl text-base leading-8 text-[#526782]">A field record about sharing Korean traditional archery posture, safety, concentration, and cultural meaning with international students.</p></div>
          </article>
        </div>
      </section>

      <section id="join" className="scroll-mt-36 bg-[#163c68] py-20 text-white sm:py-28">
        <div className="mx-auto flex max-w-[1250px] flex-col gap-8 px-5 md:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.34em] text-[#b8c7d9]">Become part of Hanhwal</p><h2 className="mt-5 font-serif text-5xl font-semibold tracking-tight sm:text-7xl">Join Hanhwal</h2><p className="mt-6 max-w-2xl text-lg leading-8 text-white/76">Come practice with us and become part of our community. New-member fee: 25,000 KRW · Returning-member fee: 20,000 KRW.</p></div>
          <div className="flex flex-wrap gap-3">
            <Link href="/hanhwal-join" className="inline-flex min-h-12 items-center gap-2 bg-white px-6 text-sm font-bold text-[#0b2342] transition hover:-translate-y-0.5 hover:bg-[#eaf0f7]"><I18nText en="Start registration" ko="신규회원 등록" /><ArrowRight aria-hidden className="h-4 w-4" /></Link>
            <Link href="/hanhwal-official" className="inline-flex min-h-12 items-center border border-white/55 px-6 text-sm font-bold text-white transition hover:bg-white/10">Official member lounge</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#0b2342]/10 bg-white py-10"><div className="mx-auto max-w-[1250px] px-5 text-sm leading-7 text-[#526782] md:px-8"><p className="font-bold text-[#0b2342]">한활 Hanhwal</p><p className="mt-2">Korean Traditional Archery Club · This public page is maintained by Hanhwal members.</p></div></footer>
    </div>
  );
}

function FactCard({ icon: Icon, eyebrow, value }: { icon: typeof CalendarDays; eyebrow: string; value: string }) {
  return <div className="border border-[#0b2342]/10 bg-[#f7f9fc] p-6 sm:p-7"><Icon aria-hidden className="h-6 w-6 text-[#163c68]" /><p className="mt-8 text-xs font-extrabold uppercase tracking-[0.24em] text-[#526782]">{eyebrow}</p><p className="mt-2 font-serif text-2xl font-semibold leading-tight text-[#0b2342]">{value}</p></div>;
}

function LocationDetail({ icon: Icon, title, detail }: { icon: typeof MapPin; title: string; detail: string }) {
  return <div className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#eaf0f7] text-[#163c68]"><Icon aria-hidden className="h-5 w-5" /></span><div><p className="text-sm font-bold text-[#0b2342]">{title}</p><p className="mt-1 text-sm leading-6 text-[#526782]">{detail}</p></div></div>;
}

function GalleryImage({ alt, className = "", sizes, src }: { alt: string; className?: string; sizes: string; src: string }) {
  return <div className={`group relative overflow-hidden bg-[#eaf0f7] ${className}`}><Image src={src} alt={alt} fill sizes={sizes} className="object-cover transition duration-500 group-hover:scale-[1.025]" /></div>;
}

function EquipmentCard({ alt, detail, src, title }: { alt: string; detail: string; src: string; title: string }) {
  return <article className="overflow-hidden bg-white text-[#0b2342]"><div className="relative aspect-square bg-[#f3f6fa]"><Image src={src} alt={alt} fill sizes="(max-width: 640px) 100vw, 30vw" className="object-cover" /></div><div className="p-6"><h3 className="font-serif text-2xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-[#526782]">{detail}</p></div></article>;
}
