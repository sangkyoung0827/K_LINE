import type { Metadata } from "next";
import { I18nText } from "@/components/LanguageProvider";
import { ProjectSubmitForm } from "@/components/ProjectSubmitForm";
import { SectionHeader } from "@/components/SectionHeader";
import { requirePrivilegedAccess } from "@/lib/privilegedAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Submit K-Culture Project",
  description:
    "Submit a K-culture project to K_LINE for pending review.",
  path: "/k-culture-project/submit"
});

export default async function ProjectSubmitPage() {
  await requirePrivilegedAccess();

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:px-8">
        <SectionHeader
          eyebrow={<I18nText en="Pending review" ko="검토 대기" />}
          title={<I18nText en="Share a cultural project" ko="문화 프로젝트 공유하기" />}
          description={
            <I18nText
              en="Submissions are saved for super-admin review and are not publicly posted until moderation is complete."
              ko="제출 내용은 슈퍼관리자 검토용으로 저장되며, 검토가 완료될 때까지 공개 게시되지 않습니다."
            />
          }
        />
        <ProjectSubmitForm />
      </div>
    </section>
  );
}
