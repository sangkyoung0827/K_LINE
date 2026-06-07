import type { Metadata } from "next";
import { FreeBoardPage } from "@/components/FreeBoardPage";
import { getActivityBoardById } from "@/data/activityBoards";
import { seoKeywords, siteConfig } from "@/lib/seo";

const board = getActivityBoardById("hanhwal");

export const metadata: Metadata = {
  title: "Hanhwal Free Board",
  description: "한활 Hanhwal 자유게시판 for community posts and photo activity records on K_LINE.",
  keywords: [...seoKeywords, "Hanhwal", "한활 자유게시판"],
  openGraph: {
    title: "Hanhwal Free Board | K_LINE",
    description: "Write and view Hanhwal community board posts on K_LINE.",
    url: `${siteConfig.url}/our-activities/hanhwal`
  },
  alternates: {
    canonical: `${siteConfig.url}/our-activities/hanhwal`
  }
};

export default function HanhwalFreeBoardPage() {
  return <FreeBoardPage board={board!} />;
}
