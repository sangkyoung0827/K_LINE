import type { Metadata } from "next";
import { JejuExplorerDashboard } from "@/components/jeju/JejuExplorerDashboard";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Jeju Explorer",
  description: "Private K_LINE Jeju Explorer map, memories, profile, programs, and Woohyukmon guide.",
  path: "/jeju"
});

export default function JejuExplorerPage() {
  return <JejuExplorerDashboard />;
}
