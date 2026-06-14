import type { Metadata } from "next";
import { FreeBoardDetailPage } from "@/components/FreeBoardDetailPage";
import { getActivityBoardById } from "@/data/activityBoards";
import { createNoIndexMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ postId: string }>;
};

const board = getActivityBoardById("ecc");

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Board Post",
  description: "Read an ECC 자유게시판 post on K_LINE.",
  path: "/our-activities/ecc"
});

export default async function EccFreeBoardDetailPage({ params }: PageProps) {
  const { postId } = await params;
  return (
    <FreeBoardDetailPage
      board={board!}
      postId={postId}
      boardPath="/our-activities/ecc/free-board"
    />
  );
}
