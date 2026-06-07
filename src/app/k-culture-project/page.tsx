import type { Metadata } from "next";
import Image from "next/image";
import { GalleryGrid } from "@/components/GalleryGrid";
import { SectionHeader } from "@/components/SectionHeader";
import { seoKeywords } from "@/lib/seo";

export const metadata: Metadata = {
  title: "K-Culture Project",
  description:
    "한국의 선, 유럽을 잇다. K_LINE connects Jeonbuk Hanji, Korean calligraphy, 3D printing, LED lighting, and Europe.",
  keywords: seoKeywords,
  openGraph: {
    title: "K-Culture Project | K_LINE",
    description:
      "Jeonbuk Hanji, Korean calligraphy, 3D printing, LED lighting, and Europe through a Hanji Calligraphy LED Light Object."
  }
};

const sections = [
  {
    title: "Project concept",
    text: "The project connects Jeonbuk Hanji, Korean calligraphy, 3D printing, LED lighting, and Europe through one compact cultural object."
  },
  {
    title: "Hanji and calligraphy",
    text: "Hanji texture and Korean calligraphy create a visible rhythm of lines that can be understood without reducing Korean culture to decoration."
  },
  {
    title: "3D printing and LED object",
    text: "A 3D-printed frame and warm LED light make the object portable, reproducible, and suitable for workshops, exhibitions, and cultural exchange."
  },
  {
    title: "London / Europe exchange plan",
    text: "K_LINE can develop pop-up workshops, cultural goods presentations, and student exchange activities for London and European audiences."
  }
];

export default function KCultureProjectPage() {
  return (
    <>
      <section className="bg-ink py-16 text-paper md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[0.85fr_1.15fr] md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">Jeonbuk K-Culture</p>
            <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">한국의 선, 유럽을 잇다</h1>
            <p className="mt-5 text-2xl font-semibold text-paper/92">Connecting Korean Lines to Europe</p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden bg-hanji">
            <Image
              src="/images/hanji-calligraphy-led-light-object.png"
              alt="Hanji Calligraphy LED Light Object for Jeonbuk K-culture project"
              fill
              priority
              sizes="(min-width: 768px) 55vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Project archive"
            title="Hanji, calligraphy, fabrication, and warm light"
            description="The main object is a small rectangular mood lamp using a Hanji-style front panel, Korean calligraphy, a 3D-printed frame, and warm LED light. It introduces Jeonbuk traditional culture through modern design and digital fabrication."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {sections.map((section) => (
              <article key={section.title} className="paper-panel p-6">
                <h2 className="font-serif text-3xl font-semibold text-ink">{section.title}</h2>
                <p className="mt-4 text-sm leading-7 text-ink/70">{section.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/50 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Process archive"
            title="Documentation placeholders"
            description="Add real photos of Hanji tests, calligraphy trials, 3D printing, LED assembly, London exchange, and exhibition records here."
          />
          <div className="mt-10">
            <GalleryGrid placeholders={["Hanji test placeholder", "3D print process placeholder", "London exchange placeholder"]} />
          </div>
        </div>
      </section>
    </>
  );
}
