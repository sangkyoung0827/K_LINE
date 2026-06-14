"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquareText, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { ClubMark } from "@/components/ClubMark";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import type { FreeBoard, FreeBoardPost } from "@/types";
import { readFreeBoardPosts, writeFreeBoardPosts } from "@/lib/freeBoardStorage";

type FreeBoardDetailPageProps = {
  board: FreeBoard;
  postId: string;
  boardPath?: string;
};

function formatDate(value: string, locale: "en" | "ko") {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function FreeBoardDetailPage({
  board,
  postId,
  boardPath = `/our-activities/${board.slug}`
}: FreeBoardDetailPageProps) {
  const [posts, setPosts] = useState<FreeBoardPost[]>([]);
  const { isSuperAdmin } = useSuperAdmin();
  const { language } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    setPosts(readFreeBoardPosts(board));
  }, [board]);

  const post = useMemo(() => posts.find((item) => item.id === postId), [postId, posts]);
  const boardDisplayTitle = language === "ko" ? board.koreanTitle : board.title;
  const boardDisplayLabel =
    language === "ko" && board.id === "hanhwal" ? "한활" : board.label;
  const deletePost = () => {
    const nextPosts = posts.filter((item) => item.id !== postId);
    writeFreeBoardPosts(board, nextPosts);
    setPosts(nextPosts);
    router.push(boardPath);
  };

  if (!post) {
    return (
      <section className="bg-paper py-20">
        <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
          <MessageSquareText aria-hidden className="mx-auto h-12 w-12 text-brass" />
          <h1 className="mt-5 font-serif text-4xl font-semibold text-ink">
            <I18nText en="Post not found" ko="게시글을 찾을 수 없습니다" />
          </h1>
          <p className="mt-4 text-sm leading-7 text-ink/62">{boardDisplayTitle}</p>
          <Link
            href={boardPath}
            className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 border border-ink/18 px-5 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            <I18nText en="Back to board" ko="게시판으로 돌아가기" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="bg-ink py-16 text-paper md:py-24">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 md:grid-cols-[1fr_auto] md:items-end md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">{boardDisplayLabel}</p>
            <h1 className="mt-5 font-serif text-5xl font-semibold md:text-7xl">{post.title}</h1>
            <p className="mt-5 text-sm text-paper/62">
              {post.author} / {formatDate(post.createdAt, language)}
            </p>
          </div>
          <ClubMark id={board.id} size="lg" className="hidden border-4 border-white/70 shadow-lift md:inline-flex" />
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-4xl px-5 md:px-8">
          <article className="paper-panel overflow-hidden">
            {post.imageDataUrl ? (
              <img
                src={post.imageDataUrl}
                alt={`${post.title} uploaded photo`}
                className="max-h-[560px] w-full object-cover"
              />
            ) : null}
            <div className="p-6 md:p-8">
              <p className="whitespace-pre-wrap text-base leading-8 text-ink/74">{post.content}</p>
            </div>
          </article>
          <Link
            href={boardPath}
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            <I18nText en="Back to board" ko="게시판으로 돌아가기" />
          </Link>
          {isSuperAdmin ? (
            <button
              type="button"
              onClick={deletePost}
              className="ml-4 mt-8 inline-flex min-h-10 items-center justify-center gap-2 border border-red-900/20 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              <I18nText en="Delete Post" ko="게시글 삭제" />
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}
