import type { Metadata } from "next";
import { MemoryBookAppNotice } from "@/components/MemoryBookAppNotice";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Memory Book in Woohyukmon",
  description: "K_LINE Memory Book is moving to the Woohyukmon application. Existing records and photos are preserved.",
  path: "/jeju"
});

export default function JejuExplorerPage() {
  return <MemoryBookAppNotice />;
}
