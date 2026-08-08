import type { Metadata } from "next";
import { WoohyukmonChatbot } from "@/components/WoohyukmonChatbot";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "Woohyukmon",
  description: "Ask the K_LINE AI assistant Woohyukmon about ECC, K_LINE, registration, club administration, and site guidance.",
  path: "/contact",
  keywords: ["K_LINE", "Woohyukmon", "우혁몬", "ECC", "K_LINE AI"]
});

export default function ContactPage() {
  return (
    <section className="relative isolate overflow-hidden bg-paper">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.94),transparent_32rem),radial-gradient(circle_at_50%_70%,rgba(214,168,90,0.10),transparent_30rem)]" />

      <div className="relative mx-auto min-h-[calc(100svh-5rem)] w-full max-w-none">
        <WoohyukmonChatbot />
      </div>
    </section>
  );
}
