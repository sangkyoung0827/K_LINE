import type { Metadata } from "next";
import { ResearchArchive } from "@/components/research/ResearchArchive";
import { getResearchEditorAccess, listResearchItems } from "@/lib/research/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Open K-Culture Research",
  description: "Exploring Korean Culture, Tradition & Experience",
  alternates: { canonical: "/open-k-culture-research" }
};

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ organization?: string; tag?: string }> }) {
  const [items, editor] = await Promise.all([listResearchItems(), getResearchEditorAccess()]);
  const filters = await searchParams;
  return <ResearchArchive initialItems={items} canEdit={editor.canEdit} canManageEditors={editor.canManageEditors} initialOrganization={filters.organization || ""} initialTag={filters.tag || ""} />;
}
