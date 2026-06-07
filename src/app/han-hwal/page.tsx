import type { Metadata } from "next";
import { CTAButton } from "@/components/CTAButton";
import { GalleryGrid } from "@/components/GalleryGrid";
import { SectionHeader } from "@/components/SectionHeader";
import { seoKeywords } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Han-hwal",
  description:
    "Han-hwal is the K_LINE base for Korean traditional archery, body-mind training, and cultural exchange.",
  keywords: seoKeywords,
  openGraph: {
    title: "Han-hwal | K_LINE",
    description:
      "우리는 국궁으로 심신을 수련하는 한활입니다. Han-hwal trains body and mind through Korean traditional archery."
  }
};

const activities = [
  "Korean traditional archery practice",
  "Body-mind discipline and focus training",
  "Cultural exchange with students and visitors",
  "Traditional martial culture explanation",
  "K-culture project collaboration"
];

export default function HanHwalPage() {
  return (
    <>
      <section className="bg-ink py-16 text-paper md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <p className="text-sm font-semibold uppercase text-brass">Main base</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">한활 Han-hwal</h1>
          <p className="mt-6 max-w-3xl text-2xl font-semibold text-paper">
            우리는 국궁으로 심신을 수련하는 한활입니다.
          </p>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-paper/72">
            Han-hwal is a community that trains body and mind through Korean traditional archery.
          </p>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:grid-cols-[0.9fr_1.1fr] md:px-8">
          <SectionHeader
            eyebrow="About Han-hwal"
            title="A practice base for Korean archery and cultural exchange"
            description="Han-hwal introduces Korean archery, discipline, body-mind training, and traditional culture. It connects Korean students, international students, and foreign visitors through grounded cultural activities."
          />
          <div className="grid gap-6">
            <div className="paper-panel p-6">
              <h2 className="font-serif text-3xl font-semibold text-ink">Korean Archery Philosophy</h2>
              <p className="mt-4 text-base leading-8 text-ink/70">
                Korean traditional archery is more than aiming at a target. It asks the body to
                settle, the breath to steady, and the mind to follow the line of the bow. K_LINE
                presents this philosophy to international visitors through Han-hwal.
              </p>
            </div>
            <div className="paper-panel p-6">
              <h2 className="font-serif text-3xl font-semibold text-ink">Activities</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-7 text-ink/70">
                {activities.map((activity) => (
                  <li key={activity}>{activity}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/50 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Gallery placeholder"
            title="Practice, bow lines, and cultural moments"
            description="Real Han-hwal class and project archive images can replace these placeholders after the first field documentation."
          />
          <div className="mt-10">
            <GalleryGrid placeholders={["Archery practice placeholder", "Han-hwal group placeholder", "Cultural exchange placeholder"]} />
          </div>
          <div className="mt-10">
            <CTAButton href="/contact">Contact / Join Inquiry</CTAButton>
          </div>
        </div>
      </section>
    </>
  );
}
