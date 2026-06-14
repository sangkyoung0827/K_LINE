import type { Metadata } from "next";
import { BookingForm } from "@/components/BookingForm";
import { SectionHeader } from "@/components/SectionHeader";
import { classes } from "@/data/classes";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "Archery Class",
  description:
    "Book Korean traditional archery classes with K_LINE and Han-hwal for students, visitors, and cultural groups.",
  path: "/archery-class",
  keywords: ["Korean traditional archery", "Han-hwal", "Korean archery class"]
});

const learnItems = [
  "Basic safety rules",
  "Korean traditional bow posture",
  "Basic shooting practice",
  "Cultural meaning of Korean archery",
  "Optional traditional martial culture explanation"
];

const participants = [
  "International students",
  "Foreign visitors",
  "Korean students",
  "Cultural experience groups"
];

export default function ArcheryClassPage() {
  return (
    <>
      <section className="bg-navy py-16 text-paper md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <p className="text-sm font-semibold uppercase text-brass">Korean traditional archery</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">Archery Class</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-paper/74">
            K_LINE opens inquiry-based Korean archery class booking for international students,
            foreign visitors, Korean students, and cultural experience groups.
          </p>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[1fr_0.9fr] md:px-8">
          <div>
            <SectionHeader
              eyebrow="Class introduction"
              title="Train posture, safety, focus, and cultural meaning"
              description="Participants learn how Korean traditional archery connects the body, bow, breath, discipline, and cultural memory."
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <InfoList title="Who can join" items={participants} />
              <InfoList title="What participants learn" items={learnItems} />
            </div>
            <div className="mt-10 grid gap-5">
              {classes.map((item) => (
                <article key={item.id} className="paper-panel p-6">
                  <p className="text-sm font-semibold text-brass">{item.koreanTitle}</p>
                  <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">{item.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-ink/70">{item.description}</p>
                  <p className="mt-4 text-sm font-semibold text-ink">{item.durationPlaceholder} / {item.pricePlaceholder}</p>
                </article>
              ))}
            </div>
          </div>
          <BookingForm />
        </div>
      </section>
    </>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="paper-panel p-6">
      <h2 className="font-serif text-2xl font-semibold text-ink">{title}</h2>
      <ul className="mt-4 grid gap-3 text-sm text-ink/70">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
