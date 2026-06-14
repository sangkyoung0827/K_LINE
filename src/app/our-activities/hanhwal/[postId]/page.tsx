import type { Metadata } from "next";
import { FreeBoardDetailPage } from "@/components/FreeBoardDetailPage";
import { getActivityBoardById } from "@/data/activityBoards";
import { createNoIndexMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ postId: string }>;
};

const board = getActivityBoardById("hanhwal");

export const metadata: Metadata = createNoIndexMetadata({
  title: "Hanhwal Board Post",
  description: "Read a 한활 Hanhwal 자유게시판 post on K_LINE.",
  path: "/our-activities/hanhwal"
});

export default async function HanhwalFreeBoardDetailPage({ params }: PageProps) {
  const { postId } = await params;
  return <FreeBoardDetailPage board={board!} postId={postId} />;
}
