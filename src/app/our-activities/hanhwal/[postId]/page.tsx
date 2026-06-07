import type { Metadata } from "next";
import { FreeBoardDetailPage } from "@/components/FreeBoardDetailPage";
import { getActivityBoardById } from "@/data/activityBoards";
import { seoKeywords, siteConfig } from "@/lib/seo";

type PageProps = {
  params: Promise<{ postId: string }>;
};

const board = getActivityBoardById("hanhwal");

export const metadata: Metadata = {
  title: "Hanhwal Board Post",
  description: "Read a 한활 Hanhwal 자유게시판 post on K_LINE.",
  keywords: [...seoKeywords, "Hanhwal", "한활 자유게시판"],
  openGraph: {
    title: "Hanhwal Board Post | K_LINE",
    description: "Read a Hanhwal community board post on K_LINE.",
    url: `${siteConfig.url}/our-activities/hanhwal`
  }
};

export default async function HanhwalFreeBoardDetailPage({ params }: PageProps) {
  const { postId } = await params;
  return <FreeBoardDetailPage board={board!} postId={postId} />;
}
