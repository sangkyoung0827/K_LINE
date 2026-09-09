export type ClubKey = "ecc" | "hanhwal";
export type ThemeId = "default" | "warm" | "nature" | "mono";
export interface HeroSectionData { title: string; subtitle: string; imageUrl: string; buttonLabel: string; buttonUrl: string }
export interface AboutSectionData { heading: string; body: string }
export interface GallerySectionData { heading: string; images: { imageUrl: string; caption: string }[] }
export interface ScheduleSectionData { heading: string; items: { date: string; title: string; description: string }[] }
export interface MembersSectionData { heading: string; members: { name: string; role: string; imageUrl: string; description: string }[] }
export interface RecruitSectionData { heading: string; description: string; buttonLabel: string; buttonUrl: string }
export interface LinksSectionData { heading: string; links: { label: string; url: string }[] }
export interface SectionDataMap {
  hero: HeroSectionData; about: AboutSectionData; gallery: GallerySectionData;
  schedule: ScheduleSectionData; members: MembersSectionData; recruit: RecruitSectionData; links: LinksSectionData;
}
export type SectionType = keyof SectionDataMap;
export type ClubSection = { [K in SectionType]: { id: string; type: K; data: SectionDataMap[K] } }[SectionType];
export interface ClubDocument { themeId: ThemeId; sections: ClubSection[] }
export interface ClubDraft extends ClubDocument { revision: number; isPublished: boolean }
