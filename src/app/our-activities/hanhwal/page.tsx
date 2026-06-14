import type { Metadata } from "next";
import { FreeBoardPage } from "@/components/FreeBoardPage";
import { getActivityBoardById } from "@/data/activityBoards";
import { createPublicMetadata } from "@/lib/seo";

const board = getActivityBoardById("hanhwal");

export const metadata: Metadata = createPublicMetadata({
  title: "Han-hwal",
  description:
    "Han-hwal on K_LINE introduces Korean traditional archery, student practice records, campus culture, and Korean cultural community stories.",
  path: "/our-activities/hanhwal",
  keywords: ["Han-hwal", "Korean traditional archery", "Korean archery", "campus culture"]
});

export default function HanhwalFreeBoardPage() {
  return <FreeBoardPage board={board!} />;
}
