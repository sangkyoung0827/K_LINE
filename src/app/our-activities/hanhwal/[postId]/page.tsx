import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HanhwalFreeBoardDetailPage } from "@/components/HanhwalFreeBoardDetailPage";
import { getActivityBoardById } from "@/data/activityBoards";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
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

export default async function HanhwalBoardDetailRoutePage({ params }: PageProps) {
  const access = await getCurrentHanhwalAccess();

  if (!access.isOfficialMember) {
    notFound();
  }

  const { postId } = await params;
  return (
    <HanhwalFreeBoardDetailPage
      board={board!}
      postId={postId}
      boardPath="/our-activities/hanhwal/free-board"
    />
  );
}
