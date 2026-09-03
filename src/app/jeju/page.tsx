import type { Metadata } from "next";
import { JejuExplorerDashboard } from "@/components/jeju/JejuExplorerDashboard";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Korea Memory Book",
  description: "Private K_LINE Korea Memory Book with a live South Korea map, personal place ratings, photos, journey records, and Woohyukmon.",
  path: "/jeju"
});

export default function JejuExplorerPage() {
  return <JejuExplorerDashboard />;
}
