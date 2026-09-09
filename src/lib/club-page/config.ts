import type { ClubKey, ClubSection, SectionType } from "@/types/club-page";

export const CLUB_PAGE_CONFIG = {
  ecc: { label: "ECC", englishLabel: "ECC", publicPath: "/clubs/ecc", joinPath: "/ecc-join", officialPath: "/ecc-official", editPath: "/our-activities/ecc/website/edit" },
  hanhwal: { label: "한활", englishLabel: "Hanhwal", publicPath: "/clubs/hanhwal", joinPath: "/hanhwal-join", officialPath: "/hanhwal-official", editPath: "/our-activities/hanhwal/website/edit" }
} as const;
export const THEME_PRESETS = [
  { id: "default", name: "기본", primary: "#2563eb", background: "#ffffff", foreground: "#171717", muted: "#525252", surface: "#f5f7fa" },
  { id: "warm", name: "따뜻한", primary: "#ea580c", background: "#fffaf7", foreground: "#29201c", muted: "#65554c", surface: "#ffeddc" },
  { id: "nature", name: "자연", primary: "#16a34a", background: "#fcfffc", foreground: "#17291e", muted: "#496652", surface: "#eaf5ed" },
  { id: "mono", name: "모노톤", primary: "#171717", background: "#ffffff", foreground: "#171717", muted: "#525252", surface: "#f2f2f2" }
] as const;
export const SECTION_LABELS = { hero: "Hero · 첫 화면", about: "About · 소개", gallery: "Gallery · 사진", schedule: "Schedule · 일정", members: "Members · 운영진", recruit: "Recruit · 모집", links: "Links · 링크" } as const;
export function isClubKey(value: string): value is ClubKey { return value === "ecc" || value === "hanhwal"; }
export function newSection(type: SectionType, clubKey: ClubKey): ClubSection {
  const defaults = {
    hero: { title: "", subtitle: "", imageUrl: "", buttonLabel: "", buttonUrl: "" },
    about: { heading: "", body: "" }, gallery: { heading: "", images: [] },
    schedule: { heading: "", items: [] }, members: { heading: "", members: [] },
    recruit: { heading: "", description: "", buttonLabel: "가입 신청", buttonUrl: CLUB_PAGE_CONFIG[clubKey].joinPath },
    links: { heading: "", links: [] }
  };
  return { id: crypto.randomUUID(), type, data: defaults[type] } as ClubSection;
}
