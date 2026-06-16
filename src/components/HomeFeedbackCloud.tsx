"use client";

import { MessageCircle, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

type HomeComment = {
  id: string;
  text: string;
  createdAt: string;
};

const storageKey = "k_line_home_feedback_comments";

const starterComments: HomeComment[] = [
  {
    id: "starter-1",
    text: "London project 과정이 더 궁금해요.",
    createdAt: "2026-06-16T00:00:00.000Z"
  },
  {
    id: "starter-2",
    text: "ECC 활동 신청이 한눈에 보여서 좋아요.",
    createdAt: "2026-06-16T00:01:00.000Z"
  },
  {
    id: "starter-3",
    text: "상품 사진이 실제 프로젝트처럼 보여요.",
    createdAt: "2026-06-16T00:02:00.000Z"
  }
];

function readComments() {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as HomeComment[]) : [];
  } catch {
    return [];
  }
}

function writeComments(comments: HomeComment[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(comments));
}

export function HomeFeedbackCloud() {
  const { language } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState("");
  const [comments, setComments] = useState<HomeComment[]>([]);
  const visibleComments = useMemo(
    () => [...comments, ...starterComments].slice(0, 7),
    [comments]
  );

  useEffect(() => {
    setComments(readComments());
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 164)}px`;
  }, [text]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const nextComment: HomeComment = {
      id: `home-comment-${Date.now()}`,
      text: trimmed,
      createdAt: new Date().toISOString()
    };
    const nextComments = [nextComment, ...comments].slice(0, 18);
    setComments(nextComments);
    writeComments(nextComments);
    setText("");
  };

  return (
    <aside className="relative min-h-[430px] w-full overflow-hidden rounded-none border border-paper/18 bg-paper/12 p-4 shadow-soft backdrop-blur-md md:p-5">
      <div className="flex items-start gap-3">
        <MugunghwaMark />
        <div>
          <p className="text-xs font-semibold uppercase text-brass">
            <I18nText en="Visitor notes" ko="방문자 코멘트" />
          </p>
          <h2 className="mt-1 text-lg font-semibold text-paper">
            <I18nText en="Leave a small thought" ko="사이트 피드백을 남겨주세요" />
          </h2>
        </div>
      </div>

      <form onSubmit={submit} className="relative z-10 mt-4 grid gap-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          maxLength={260}
          className="min-h-16 resize-none border border-paper/18 bg-white/88 px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-brass focus:shadow-[0_0_0_3px_rgba(214,168,90,0.24)]"
          placeholder={
            language === "ko"
              ? "요청사항, 응원, 불편한 점을 짧게 남겨주세요."
              : "Leave feedback, requests, or small notes."
          }
        />
        <button
          type="submit"
          className="inline-flex min-h-10 w-fit items-center justify-center gap-2 bg-brass px-4 text-xs font-semibold text-ink transition hover:bg-paper"
        >
          <Send aria-hidden className="h-3.5 w-3.5" />
          <I18nText en="Post note" ko="코멘트 남기기" />
        </button>
      </form>

      <div className="pointer-events-none absolute inset-x-3 bottom-4 top-40">
        {visibleComments.map((comment, index) => (
          <FloatingComment
            key={comment.id}
            comment={comment}
            index={index}
            language={language}
          />
        ))}
      </div>
    </aside>
  );
}

function FloatingComment({
  comment,
  index,
  language
}: {
  comment: HomeComment;
  index: number;
  language: "en" | "ko";
}) {
  const positions = [
    "left-[2%] top-[4%] max-w-[76%]",
    "right-[3%] top-[18%] max-w-[72%]",
    "left-[12%] top-[36%] max-w-[78%]",
    "right-[8%] top-[54%] max-w-[68%]",
    "left-[4%] top-[72%] max-w-[74%]",
    "right-[18%] top-[2%] max-w-[60%]",
    "left-[26%] top-[61%] max-w-[64%]"
  ];
  const delays = ["0s", "-2.2s", "-4.4s", "-1.1s", "-3.3s", "-5.2s", "-6.1s"];

  return (
    <div
      className={`feedback-float absolute ${positions[index % positions.length]} rounded-none border border-paper/20 bg-white/82 px-3 py-2 text-xs leading-5 text-ink shadow-soft`}
      style={{ animationDelay: delays[index % delays.length] }}
    >
      <div className="flex items-start gap-2">
        <MessageCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" />
        <div>
          <p className="whitespace-pre-wrap break-keep">{comment.text}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase text-ink/42">
            {language === "ko" ? "방문자 메모" : "Visitor note"}
          </p>
        </div>
      </div>
    </div>
  );
}

function MugunghwaMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      className="h-12 w-12 shrink-0 text-brass drop-shadow"
      fill="none"
    >
      <path
        d="M32 28C23 12 8 15 11 29c2 10 13 11 21-1Z"
        fill="currentColor"
        opacity="0.92"
      />
      <path
        d="M32 28c9-16 24-13 21 1-2 10-13 11-21-1Z"
        fill="currentColor"
        opacity="0.82"
      />
      <path
        d="M31 31C15 22 5 34 16 43c8 7 17 1 15-12Z"
        fill="#F4EBDD"
        opacity="0.92"
      />
      <path
        d="M33 31c16-9 26 3 15 12-8 7-17 1-15-12Z"
        fill="#F4EBDD"
        opacity="0.86"
      />
      <path
        d="M32 34c-5 17 8 24 15 12 5-9-3-16-15-12Z"
        fill="#6B8F71"
        opacity="0.88"
      />
      <circle cx="32" cy="31" r="6" fill="#1F2A44" />
      <circle cx="32" cy="31" r="2.4" fill="#D6A85A" />
    </svg>
  );
}
