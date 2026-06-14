import type { Metadata } from "next";
import { FreeBoardPage } from "@/components/FreeBoardPage";
import { getActivityBoardById } from "@/data/activityBoards";
import { createPublicMetadata } from "@/lib/seo";

const board = getActivityBoardById("ecc");

export const metadata: Metadata = createPublicMetadata({
  title: "ECC Free Board",
  description: "ECC 자유게시판 for community posts and photo activity records on K_LINE.",
  path: "/our-activities/ecc/free-board",
  keywords: ["ECC", "ECC free board", "international students"]
});

export default function EccFreeBoardPage() {
  return (
    <FreeBoardPage
      board={board!}
      returnHref="/our-activities/ecc"
      returnLabel="Back to ECC Menu"
    />
  );
}
