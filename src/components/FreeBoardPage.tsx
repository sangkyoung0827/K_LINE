"use client";

import Link from "next/link";
import { ArrowLeft, ImagePlus, MessageSquareText, Send, SquarePen, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import type { FreeBoard, FreeBoardPost } from "@/types";
import {
  readFreeBoardPosts,
  sortPostsByNewest,
  writeFreeBoardPosts
} from "@/lib/freeBoardStorage";

type FreeBoardPageProps = {
  board: FreeBoard;
  returnHref?: string;
  returnLabel?: string;
};

const initialForm = {
  title: "",
  author: "",
  content: "",
  imageDataUrl: "",
  imageName: ""
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function FreeBoardPage({
  board,
  returnHref,
  returnLabel = "Back"
}: FreeBoardPageProps) {
  const [posts, setPosts] = useState<FreeBoardPost[]>([]);
  const [form, setForm] = useState(initialForm);
  const [imageError, setImageError] = useState("");
  const { isSuperAdmin } = useSuperAdmin();

  useEffect(() => {
    setPosts(readFreeBoardPosts(board));
  }, [board]);

  const sortedPosts = useMemo(() => sortPostsByNewest(posts), [posts]);
  const basePath = `/our-activities/${board.slug}`;

  const update = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImageError("");

    if (!file) {
      update("imageDataUrl", "");
      update("imageName", "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setImageError("이미지 파일만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    if (file.size > 1_800_000) {
      setImageError("사진은 1.8MB 이하 파일을 선택해 주세요.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      update("imageDataUrl", String(reader.result));
      update("imageName", file.name);
    };
    reader.readAsDataURL(file);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const nextPost: FreeBoardPost = {
      id: `${board.id}-${Date.now()}`,
      boardId: board.id,
      title: form.title.trim(),
      author: form.author.trim(),
      content: form.content.trim(),
      createdAt: now,
      imageDataUrl: form.imageDataUrl || undefined,
      imageName: form.imageName || undefined
    };
    const nextPosts = [nextPost, ...posts];
    writeFreeBoardPosts(board, nextPosts);
    setPosts(nextPosts);
    setForm(initialForm);
    setImageError("");
  };

  const deletePost = (postId: string) => {
    const nextPosts = posts.filter((post) => post.id !== postId);
    writeFreeBoardPosts(board, nextPosts);
    setPosts(nextPosts);
  };

  return (
    <>
      <section className="bg-navy py-16 text-paper md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <p className="text-sm font-semibold uppercase text-brass">International Clubs</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">
            {board.koreanTitle}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-paper/74">{board.description}</p>
          {returnHref ? (
            <Link
              href={returnHref}
              className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 border border-paper/22 px-5 text-sm font-semibold text-paper transition hover:border-brass hover:bg-brass/15"
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
              {returnLabel}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-8 lg:grid-cols-[0.82fr_1.18fr]">
          <form onSubmit={submit} className="paper-panel grid content-start gap-4 p-5 md:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center border border-ink/14">
                <SquarePen aria-hidden className="h-5 w-5 text-brass" />
              </span>
              <div>
                <h2 className="font-serif text-3xl font-semibold text-ink">Write Post</h2>
                <p className="text-sm text-ink/58">{board.label}</p>
              </div>
            </div>

            <input
              required
              className="form-field"
              placeholder="Title"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
            />
            <input
              required
              className="form-field"
              placeholder="Name"
              value={form.author}
              onChange={(event) => update("author", event.target.value)}
            />
            <textarea
              required
              className="form-field min-h-44"
              placeholder="Content"
              value={form.content}
              onChange={(event) => update("content", event.target.value)}
            />

            <label className="grid cursor-pointer gap-3 border border-dashed border-ink/18 bg-white/35 p-4 transition hover:border-brass hover:bg-brass/10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <ImagePlus aria-hidden className="h-4 w-4" />
                Photo
              </span>
              <input type="file" accept="image/*" onChange={selectImage} className="text-sm" />
              {form.imageName ? (
                <span className="text-xs text-ink/58">{form.imageName}</span>
              ) : null}
              {imageError ? <span className="text-xs font-semibold text-red-700">{imageError}</span> : null}
            </label>

            {form.imageDataUrl ? (
              <div className="overflow-hidden border border-ink/12 bg-hanji">
                <img
                  src={form.imageDataUrl}
                  alt="Selected upload preview"
                  className="h-48 w-full object-cover"
                />
              </div>
            ) : null}

            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-navy"
            >
              <Send aria-hidden className="h-4 w-4" />
              Post
            </button>
          </form>

          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase text-brass">Free board</p>
                <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">
                  {board.label} posts
                </h2>
              </div>
              <span className="text-sm text-ink/54">{sortedPosts.length} posts</span>
            </div>

            {sortedPosts.length > 0 ? (
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {sortedPosts.map((post) => (
                  <article
                    key={post.id}
                    className="paper-panel grid overflow-hidden transition hover:border-brass hover:bg-white/70"
                  >
                    <Link href={`${basePath}/${post.id}`} className="grid">
                      <div className="aspect-[4/3] bg-hanji">
                        {post.imageDataUrl ? (
                          <img
                            src={post.imageDataUrl}
                            alt={`${post.title} uploaded photo`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-ink/38">
                            <MessageSquareText aria-hidden className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <div className="grid gap-3 p-5">
                        <p className="text-xs font-semibold uppercase text-brass">{board.label}</p>
                        <h3 className="line-clamp-2 font-serif text-2xl font-semibold text-ink">
                          {post.title}
                        </h3>
                        <p className="text-sm text-ink/58">
                          {post.author} / {formatDate(post.createdAt)}
                        </p>
                        <p className="line-clamp-3 text-sm leading-7 text-ink/68">{post.content}</p>
                      </div>
                    </Link>
                    {isSuperAdmin ? (
                      <div className="border-t border-red-900/10 p-4">
                        <button
                          type="button"
                          onClick={() => deletePost(post.id)}
                          className="inline-flex min-h-10 w-full items-center justify-center gap-2 border border-red-900/20 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                          Delete Post
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="paper-panel mt-8 flex min-h-64 items-center justify-center p-8 text-center">
                <div>
                  <MessageSquareText aria-hidden className="mx-auto h-10 w-10 text-brass" />
                  <p className="mt-4 text-lg font-semibold text-ink">No posts yet</p>
                  <p className="mt-2 text-sm text-ink/60">{board.koreanTitle}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
