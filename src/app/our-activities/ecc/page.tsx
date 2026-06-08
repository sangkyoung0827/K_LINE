import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Banknote, MessageSquareText, ShieldCheck, Users } from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";
import { seoKeywords, siteConfig } from "@/lib/seo";

const eccTools = [
  {
    eyebrow: "Free board",
    title: "ECC 자유게시판",
    description:
      "ECC 활동 기록, 사진, 질문, 공지, 자유로운 학생 커뮤니티 글을 시간순 카드 형태로 공유합니다.",
    href: "/our-activities/ecc/free-board",
    cta: "Open Free Board",
    icon: MessageSquareText
  },
  {
    eyebrow: "Fund management",
    title: "ECC 자금관리",
    description:
      "일반회원은 남아있는 금액과 후원 계좌를 확인하고, 슈퍼관리자는 직접 금액과 계좌 정보를 입력합니다.",
    href: "/our-activities/ecc/fund",
    cta: "Open Fund Page",
    icon: Banknote
  }
];

export const metadata: Metadata = {
  title: "ECC Club Hub",
  description:
    "ECC club menu for the K_LINE free board and fund management page with role-aware super admin controls.",
  keywords: [...seoKeywords, "ECC", "ECC 자유게시판", "ECC 자금관리"],
  openGraph: {
    title: "ECC Club Hub | K_LINE",
    description: "Open the ECC free board or fund management page on K_LINE.",
    url: `${siteConfig.url}/our-activities/ecc`
  },
  alternates: {
    canonical: `${siteConfig.url}/our-activities/ecc`
  }
};

export default function EccHubPage() {
  return (
    <>
      <section className="bg-navy py-16 text-paper md:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-[1fr_auto] md:items-end md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">
              International Clubs / ECC
            </p>
            <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">ECC Menu</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-paper/74">
              ECC 안에서 자유게시판과 자금관리를 함께 운영합니다. 같은 사이트 주소에서
              로그인한 계정 권한에 따라 보이는 관리 기능만 달라집니다.
            </p>
          </div>
          <div className="hidden h-20 w-20 items-center justify-center border border-paper/20 bg-paper/8 md:flex">
            <Users aria-hidden className="h-9 w-9 text-brass" />
          </div>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="ECC tools"
            title="자유게시판과 자금관리"
            description="일반회원은 게시글과 공개 금액을 확인하고, 슈퍼관리자는 같은 화면에서 삭제와 금액 입력 권한을 사용합니다."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {eccTools.map((tool) => {
              const Icon = tool.icon;

              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="paper-panel group grid min-h-72 content-between p-6 transition hover:border-brass hover:bg-white/70 hover:shadow-soft md:p-8"
                >
                  <div>
                    <div className="flex h-12 w-12 items-center justify-center bg-navy text-paper transition group-hover:bg-brass group-hover:text-ink">
                      <Icon aria-hidden className="h-5 w-5" />
                    </div>
                    <p className="mt-6 text-sm font-semibold uppercase text-brass">
                      {tool.eyebrow}
                    </p>
                    <h2 className="mt-3 font-serif text-4xl font-semibold text-ink">
                      {tool.title}
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-ink/68">{tool.description}</p>
                  </div>
                  <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4">
                    {tool.cta}
                    <ArrowRight
                      aria-hidden
                      className="h-4 w-4 transition group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="paper-panel mt-10 grid gap-6 p-6 md:grid-cols-2 md:p-8">
            <div>
              <div className="flex h-10 w-10 items-center justify-center border border-ink/14">
                <Users aria-hidden className="h-5 w-5 text-brass" />
              </div>
              <h3 className="mt-4 font-serif text-3xl font-semibold text-ink">일반회원 화면</h3>
              <p className="mt-3 text-sm leading-7 text-ink/64">
                자유게시판에서 글과 사진을 올릴 수 있고, 자금관리에서 공개된 잔액과 후원
                계좌를 확인할 수 있습니다.
              </p>
            </div>
            <div>
              <div className="flex h-10 w-10 items-center justify-center border border-ink/14">
                <ShieldCheck aria-hidden className="h-5 w-5 text-brass" />
              </div>
              <h3 className="mt-4 font-serif text-3xl font-semibold text-ink">슈퍼관리자 화면</h3>
              <p className="mt-3 text-sm leading-7 text-ink/64">
                같은 페이지에 로그인하면 게시글 삭제, 후원 의향 관리, 후원금 총액과 남은
                계좌 금액 입력 영역이 추가로 표시됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
