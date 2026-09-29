export const researchCategories = [
  "Research Note", "Cultural Note", "Field Note", "Translation Note",
  "Experience Report", "Comparative Culture", "Archive"
] as const;

export const researchTopics = [
  "Korean Traditional Mind-Body Culture", "Korean Archery", "Meditation & Mindfulness",
  "Traditional Philosophy", "Korean Etiquette", "Tea & Traditional Lifestyle",
  "Translation & Interpretation", "International Perspectives"
] as const;

export type ResearchItem = {
  id: string;
  titleKo: string;
  titleEn: string;
  subtitleKo: string;
  subtitleEn: string;
  summaryKo: string;
  summaryEn: string;
  bodyKo: string;
  bodyEn: string;
  category: string;
  topic: string;
  tags: string[];
  coverPath: string;
  imagePaths: string[];
  attachmentPaths: string[];
  authorName: string;
  authorOrganization: string;
  relatedOrganizationId: string;
  relatedActivityId: string;
  quotes: string[];
  references: string[];
  status: "draft" | "published" | "archived";
  visibility: "public" | "members" | "private";
  isSample: boolean;
  createdBy: string;
  publishedAt: string;
  updatedAt: string;
};

export function isPublicResearch(item: Pick<ResearchItem, "status" | "visibility" | "isSample">) {
  return item.status === "published" && item.visibility === "public" && !item.isSample;
}

export function toPublicResearchItem(item: ResearchItem): ResearchItem {
  return { ...item, createdBy: "" };
}

export function filterResearchItems(items: ResearchItem[], input: {
  query?: string; category?: string; organization?: string; tag?: string;
}) {
  const query = input.query?.trim().toLocaleLowerCase() || "";
  return items.filter((item) => {
    if (input.category && item.category !== input.category) return false;
    if (input.organization && item.authorOrganization.toLocaleLowerCase() !== input.organization.toLocaleLowerCase()) return false;
    if (input.tag && !item.tags.some((tag) => tag.toLocaleLowerCase() === input.tag?.toLocaleLowerCase())) return false;
    return !query || [item.titleKo, item.titleEn, item.summaryKo, item.summaryEn, ...item.tags]
      .some((value) => value.toLocaleLowerCase().includes(query));
  });
}
