import type { Metadata } from "next";
import { JejuExplorerDashboard } from "@/components/jeju/JejuExplorerDashboard";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "My Journey",
  description: "Private K_LINE journey page with a live Google Map, profile settings, and Woohyukmon.",
  path: "/jeju"
});

export default function JejuExplorerPage() {
  return <JejuExplorerDashboard />;
}
