import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { SectionHeader } from "@/components/SectionHeader";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact K_LINE for Goods, K-Culture Project, Our Activities, Han-hwal project, or general inquiries.",
  openGraph: {
    title: "Contact | K_LINE",
    description:
      "General inquiry, Goods inquiry, K-Culture Project inquiry, and Our Activities inquiry for K_LINE."
  }
};

export default function ContactPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.85fr_1.15fr] md:px-8">
        <div>
          <SectionHeader
            eyebrow="Contact"
            title="Open a cultural conversation"
            description="Use the form for Goods, K-Culture Project, Our Activities, Han-hwal project, or future collaboration inquiries."
          />
          <div className="mt-8 grid gap-4 text-sm text-ink/70">
            <p>
              <span className="font-semibold text-ink">Email placeholder:</span> {siteConfig.emailPlaceholder}
            </p>
            <p>
              <span className="font-semibold text-ink">YouTube:</span>{" "}
              <a href={siteConfig.youtube} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                https://www.youtube.com/@Weirdsang
              </a>
            </p>
            <p>
              <span className="font-semibold text-ink">Instagram:</span> {siteConfig.instagramPlaceholder}
            </p>
          </div>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
