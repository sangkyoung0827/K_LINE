import type { Metadata } from "next";
import { WoohyukmonKnowledgeManager } from "@/components/WoohyukmonKnowledgeManager";
import { requireDeveloperAccess } from "@/lib/privilegedAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createNoIndexMetadata({
  title: "우혁몬 교육",
  description: "K_LINE developer-only WooHyukmon knowledge management.",
  path: "/developer/woohyukmon-training"
});

export default async function WoohyukmonTrainingPage() {
  await requireDeveloperAccess();
  return <WoohyukmonKnowledgeManager />;
}
