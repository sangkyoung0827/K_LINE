import type { ComponentType } from "react";
import type { SectionDataMap, SectionType } from "@/types/club-page";
import { HeroRenderer, AboutRenderer, GalleryRenderer, ScheduleRenderer, MembersRenderer, RecruitRenderer, LinksRenderer } from "./renderers/Sections";

export const SECTION_RENDERERS: { [K in SectionType]: ComponentType<{ data: SectionDataMap[K] }> } = {
  hero: HeroRenderer, about: AboutRenderer, gallery: GalleryRenderer, schedule: ScheduleRenderer,
  members: MembersRenderer, recruit: RecruitRenderer, links: LinksRenderer
};
