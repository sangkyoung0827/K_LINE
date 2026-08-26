import type { Metadata } from "next";
import { JejuMemories } from "@/components/jeju/JejuMemories";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "My Jeju Memories",
  description: "Private K_LINE Jeju Explorer visit and review memory log.",
  path: "/jeju/memories"
});

export default function JejuMemoriesPage() {
  return <JejuMemories />;
}
