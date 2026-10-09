import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResearchDetail } from "@/components/research/ResearchDetail";
import { isPublicResearch, toPublicResearchItem } from "@/lib/research/model";
import { canEditResearchItem, getResearchEditorAccess, getResearchItem, isResearchId } from "@/lib/research/server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isResearchId(id)) return { title: "Research item" };
  const item = await getResearchItem(id);
  if (!item || !isPublicResearch(item)) return { title: "Research item", robots: { index: false } };
  return { title: item.titleEn || item.titleKo, description: item.summaryEn || item.summaryKo };
}

export default async function ResearchItemPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!isResearchId(id)) notFound();
  const [item, editor] = await Promise.all([getResearchItem(id), getResearchEditorAccess()]);
  if (!item) notFound();
  const canEdit = canEditResearchItem(editor, item);
  if (!isPublicResearch(item) && !canEdit) notFound();
  return <ResearchDetail initialItem={canEdit ? item : toPublicResearchItem(item)} canEdit={canEdit} startEditing={(await searchParams).edit === "1"} />;
}
