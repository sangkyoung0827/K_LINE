import type { Metadata } from "next";
import { FreeBoardPage } from "@/components/FreeBoardPage";
import { getActivityBoardById } from "@/data/activityBoards";
import { seoKeywords, siteConfig } from "@/lib/seo";

const board = getActivityBoardById("ecc");

export const metadata: Metadata = {
  title: "ECC Free Board",
  description: "ECC 자유게시판 for community posts and photo activity records on K_LINE.",
  keywords: [...seoKeywords, "ECC", "ECC 자유게시판"],
  openGraph: {
    title: "ECC Free Board | K_LINE",
    description: "Write and view ECC community board posts on K_LINE.",
    url: `${siteConfig.url}/our-activities/ecc/free-board`
  },
  alternates: {
    canonical: `${siteConfig.url}/our-activities/ecc/free-board`
  }
};

export default function EccFreeBoardPage() {
  return (
    <FreeBoardPage
      board={board!}
      returnHref="/our-activities/ecc"
      returnLabel="Back to ECC Menu"
    />
  );
}
