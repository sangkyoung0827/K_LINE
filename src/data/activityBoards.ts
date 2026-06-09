import type { FreeBoard, FreeBoardId } from "@/types";

export const activityBoards: FreeBoard[] = [
  {
    id: "ecc",
    slug: "ecc",
    label: "ECC",
    title: "ECC Free Board",
    koreanTitle: "ECC 자유게시판",
    description: "A community board for ECC activity notes, photos, questions, and open posts.",
    storageKey: "k_line_free_board_ecc_posts"
  },
  {
    id: "hanhwal",
    slug: "hanhwal",
    label: "Hanhwal",
    title: "Hanhwal Free Board",
    koreanTitle: "한활 Hanhwal 자유게시판",
    description:
      "A community board for Hanhwal practice records, Korean archery photos, questions, and open posts.",
    storageKey: "k_line_free_board_hanhwal_posts"
  }
];

export function getActivityBoardById(id: FreeBoardId) {
  return activityBoards.find((board) => board.id === id);
}

export function getActivityBoardBySlug(slug: string) {
  return activityBoards.find((board) => board.slug === slug);
}
