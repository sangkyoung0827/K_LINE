import type { Metadata } from "next";
import { EccAlumniInquiryForm } from "@/components/EccAlumniInquiryForm";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Activity Inquiry",
  description: "Ask ECC officers whether participation in a specific ECC activity is possible.",
  path: "/ecc-alumni/activity-inquiry"
});

export default function EccAlumniActivityInquiryPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">ECC Alumni</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">Activity Inquiry</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/64">
          Anyone with Google login can ask whether they may join or participate in an ECC
          activity. Approval of an inquiry does not grant official ECC membership or official
          team chat access.
        </p>
        <div className="mt-10">
          <EccAlumniInquiryForm />
        </div>
      </div>
    </section>
  );
}
