import type { Metadata } from "next";
import { ActivityWriteForm } from "@/components/ActivityWriteForm";
import { SectionHeader } from "@/components/SectionHeader";
import { seoKeywords } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Write Club Post",
  description:
    "Write a K_LINE international club post for pending review. Authentication, moderation, database, and image upload can be connected later.",
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
          eyebrow="Pending review"
          title="Write a community club record"
          description="This is a prototype writing flow. Posts are locally saved and should be moderated before any real public publishing."
        />
        <ActivityWriteForm />
      </div>
    </section>
  );
}
