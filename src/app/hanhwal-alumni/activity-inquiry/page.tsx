import type { Metadata } from "next";
import { HanhwalAlumniInquiryForm } from "@/components/HanhwalAlumniInquiryForm";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "HANHWAL Activity Inquiry",
  description: "Ask HANHWAL officers whether participation in a specific HANHWAL activity is possible.",
  path: "/hanhwal-alumni/activity-inquiry"
});

export default function HanhwalAlumniActivityInquiryPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">HANHWAL Alumni</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">Activity Inquiry</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/64">
          Anyone with Google login can ask whether they may join or participate in an HANHWAL
          activity. Approval of an inquiry does not grant official HANHWAL membership or official
          team chat access.
        </p>
        <div className="mt-10">
          <HanhwalAlumniInquiryForm />
        </div>
      </div>
    </section>
  );
}
