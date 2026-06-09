import type { Metadata } from "next";
import { ActivityWriteForm } from "@/components/ActivityWriteForm";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { seoKeywords } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Write Club Post",
  description:
    "Write a K_LINE international club post for pending review.",
  keywords: seoKeywords,
  openGraph: {
    title: "Write Club Post | K_LINE",
    description:
      "Submit news, activity logs, reviews, field notes, or free board posts for pending review."
  }
};

export default function ActivityWritePage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:px-8">
        <SectionHeader
          eyebrow={<I18nText en="Pending review" ko="검토 대기" />}
          title={<I18nText en="Write a community club record" ko="커뮤니티 클럽 기록 작성" />}
          description={
            <I18nText
              en="Submitted posts are saved for super-admin review and stay pending until moderation is complete."
              ko="제출한 글은 슈퍼관리자 검토용으로 저장되며, 검토가 완료될 때까지 대기 상태로 유지됩니다."
            />
          }
        />
        <ActivityWriteForm />
      </div>
    </section>
  );
}
