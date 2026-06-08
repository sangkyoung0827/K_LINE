import type { Metadata } from "next";
import { DonationPanel } from "@/components/DonationPanel";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Support K_LINE campus K-culture projects, goods prototyping, and student community activities.",
  openGraph: {
    title: "Donate | K_LINE",
    description:
      "Donation pledge page for K_LINE campus K-culture projects and student activities."
  }
};

export default function DonatePage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader
          eyebrow="Support"
          title="Help K_LINE grow as a campus K-culture platform"
          description="Professors, mentors, alumni, and partner groups can support K_LINE's cultural projects, student activity boards, and goods prototyping."
        />
        <div className="mt-10">
          <DonationPanel />
        </div>
      </div>
    </section>
  );
}
