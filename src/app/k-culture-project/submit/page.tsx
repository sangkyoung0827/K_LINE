import type { Metadata } from "next";
import { ProjectSubmitForm } from "@/components/ProjectSubmitForm";
import { SectionHeader } from "@/components/SectionHeader";
import { seoKeywords } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Submit K-Culture Project",
  description:
    "Submit a K-culture project to K_LINE for pending review. Authentication, moderation, database, and image upload can be connected later.",
  keywords: seoKeywords,
  openGraph: {
    title: "Submit K-Culture Project | K_LINE",
    description:
      "Inquiry-based project submission for Korean cultural projects and global exchange."
  }
};

export default function ProjectSubmitPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:px-8">
        <SectionHeader
          eyebrow="Pending review"
          title="Share a cultural project"
          description="This form is a prototype submission flow. Submissions are not publicly posted until backend moderation, database storage, authentication, and image upload are connected."
        />
        <ProjectSubmitForm />
      </div>
    </section>
  );
}
