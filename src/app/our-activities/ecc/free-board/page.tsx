import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { FreeBoardPage } from "@/components/FreeBoardPage";
import { I18nText } from "@/components/LanguageProvider";
import { getActivityBoardById } from "@/data/activityBoards";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

const board = getActivityBoardById("ecc");

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Free Board",
  description: "ECC 자유게시판 for community posts and photo activity records on K_LINE.",
  path: "/our-activities/ecc/free-board"
});

export default async function EccFreeBoardPage() {
  const access = await getCurrentEccAccess();

  if (!access.isOfficialMember) {
    return (
      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <div className="paper-panel flex items-start gap-4 p-6 md:p-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-navy text-paper">
              <Lock aria-hidden className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-semibold text-ink">
                <I18nText en="ECC official membership required" ko="ECC 정식회원 권한이 필요합니다" />
              </h1>
              <p className="mt-3 text-sm leading-7 text-ink/68">
                <I18nText
                  en="The ECC board is available only after official membership is confirmed."
                  ko="ECC 게시판은 정식회원 승인 후 이용할 수 있습니다."
                />
              </p>
              <Link href="/our-activities/ecc" className="mt-5 inline-flex min-h-11 items-center bg-ink px-5 text-sm font-semibold text-paper">
                <I18nText en="Back to ECC Menu" ko="ECC 메뉴로 돌아가기" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <FreeBoardPage
      board={board!}
      returnHref="/our-activities/ecc"
      returnLabel="Back to ECC Menu"
    />
  );
}
