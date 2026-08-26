import type { Metadata } from "next";
import { JejuWoohyukmonPanel } from "@/components/jeju/JejuWoohyukmonPanel";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Ask Woohyukmon for Jeju",
  description: "Private personalized Jeju Explorer recommendations from Woohyukmon.",
  path: "/jeju/ai"
});

export default function JejuAiPage() {
  return <JejuWoohyukmonPanel />;
}
