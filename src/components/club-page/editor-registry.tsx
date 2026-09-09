"use client";
import type { ComponentType } from "react";
import type { SectionType } from "@/types/club-page";
import {
  HeroEditor,
  AboutEditor,
  GalleryEditor,
  ScheduleEditor,
  MembersEditor,
  RecruitEditor,
  LinksEditor,
  type EditorProps,
} from "./editors/Sections";
export const SECTION_EDITORS: {
  [K in SectionType]: ComponentType<EditorProps<K>>;
} = {
  hero: HeroEditor,
  about: AboutEditor,
  gallery: GalleryEditor,
  schedule: ScheduleEditor,
  members: MembersEditor,
  recruit: RecruitEditor,
  links: LinksEditor,
};
