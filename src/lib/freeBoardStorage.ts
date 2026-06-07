import type { FreeBoard, FreeBoardPost } from "@/types";

export function readFreeBoardPosts(board: FreeBoard): FreeBoardPost[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawPosts = window.localStorage.getItem(board.storageKey);
  if (!rawPosts) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawPosts) as FreeBoardPost[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeFreeBoardPosts(board: FreeBoard, posts: FreeBoardPost[]) {
  window.localStorage.setItem(board.storageKey, JSON.stringify(posts));
}

export function sortPostsByNewest(posts: FreeBoardPost[]) {
  return [...posts].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  );
}
