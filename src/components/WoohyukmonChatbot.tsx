"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bot, Loader2, MessageCircle, Minus, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type LocalBoardPostForAssistant = {
  author: string;
  boardId: "ecc" | "hanhwal";
  content: string;
  createdAt: string;
  id: string;
  title: string;
};

const welcomeMessages: Record<"en" | "ko", ChatMessage> = {
  en: {
    id: "welcome",
    role: "assistant",
    content:
      "Hi! I am Woohyukmon, the K_LINE AI assistant. I can explain the site, help with club administration, suggest activities, draft notices, and find visible posts."
  },
  ko: {
    id: "welcome",
    role: "assistant",
    content:
      "안녕하세요! 저는 K_LINE의 AI 보조 우혁몬입니다. 사이트 설명, 동아리 행정, 활동 아이디어, 공지 작성, 게시물 찾기까지 도와드릴게요."
  }
};

const publicQuickPrompts = {
  en: [
    "Find the Han-hwal post",
    "Draft a KakaoTalk notice",
    "Suggest ECC activity ideas",
    "How do I manage club posts?"
  ],
  ko: [
    "한활 게시물 찾아줘",
    "카카오톡 공지 작성해줘",
    "ECC 활동 아이디어 추천해줘",
    "동아리 게시글은 어떻게 관리해?"
  ]
} as const;

const superAdminQuickPrompts = {
  en: ["Summarize pending submissions", "Make an officer checklist", "Draft an event payment notice"],
  ko: ["대기 제출물 요약해줘", "임원 체크리스트 만들어줘", "활동비 납부 공지 작성해줘"]
} as const;

const developerQuickPrompts = {
  en: ["Find product draft records", "Explain developer-only areas"],
  ko: ["상품 초안 기록 찾아줘", "개발자 전용 영역 설명해줘"]
} as const;

function readLocalBoardPostsForAssistant(): LocalBoardPostForAssistant[] {
  if (typeof window === "undefined") {
    return [];
  }

  const boardKeys = [
    { boardId: "ecc" as const, key: "k_line_free_board_ecc_posts" },
    { boardId: "hanhwal" as const, key: "k_line_free_board_hanhwal_posts" }
  ];

  return boardKeys.flatMap(({ boardId, key }) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.slice(0, 30).flatMap((post) => {
        if (!post || typeof post !== "object") {
          return [];
        }

        const candidate = post as Partial<LocalBoardPostForAssistant>;
        if (
          typeof candidate.id !== "string" ||
          typeof candidate.title !== "string" ||
          typeof candidate.content !== "string"
        ) {
          return [];
        }

        return [
          {
            author: typeof candidate.author === "string" ? candidate.author.slice(0, 120) : "",
            boardId,
            content: candidate.content.slice(0, 900),
            createdAt:
              typeof candidate.createdAt === "string" ? candidate.createdAt.slice(0, 80) : "",
            id: candidate.id.slice(0, 120),
            title: candidate.title.slice(0, 180)
          }
        ];
      });
    } catch {
      return [];
    }
  });
}

function WoohyukmonAvatar({
  language,
  size = "md"
}: {
  language: "en" | "ko";
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-11 w-11";

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-brass/60 bg-navy text-paper shadow-soft ${sizeClass}`}
    >
      {failed ? (
        <span className="text-sm font-bold">{language === "ko" ? "우" : "W"}</span>
      ) : (
        <Image
          src="/images/woohyukmon-icon.png"
          alt={language === "ko" ? "우혁몬 아이콘" : "Woohyukmon AI guide icon"}
          fill
          sizes="64px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export function WoohyukmonChatbot() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const { isDeveloper, isSuperAdmin } = useSuperAdmin();
  const canSeeProjects = isSuperAdmin || isDeveloper;
  const quickPrompts = [
    ...publicQuickPrompts[language],
    ...(canSeeProjects ? [language === "ko" ? "프로젝트는 어떻게 올리나요?" : "How do I submit a project?"] : []),
    ...(isSuperAdmin ? superAdminQuickPrompts[language] : []),
    ...(isDeveloper ? developerQuickPrompts[language] : [])
  ];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessages[language]]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const apiHistory = useMemo(
    () =>
      messages
        .filter((message) => message.id !== "welcome")
        .map((message) => ({ role: message.role, content: message.content })),
    [messages]
  );

  useEffect(() => {
    setMessages((current) =>
      current.length === 1 && current[0]?.id === "welcome" ? [welcomeMessages[language]] : current
    );
  }, [language]);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/woohyukmon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: trimmed,
          history: apiHistory.slice(-6),
          localBoardPosts: readLocalBoardPostsForAssistant()
        })
      });
      const data = (await response.json()) as { answer?: string; error?: string };

      if (!response.ok || !data.answer) {
        throw new Error(
          data.error ??
            (language === "ko"
              ? "우혁몬이 잠시 대답하지 못했습니다."
              : "Woohyukmon could not answer for a moment.")
        );
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.answer ?? ""
        }
      ]);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : language === "ko"
            ? "우혁몬이 잠시 대답하지 못했습니다."
            : "Woohyukmon could not answer for a moment.";
      setError(message);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  if (pathname === "/login") {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70] hidden md:block md:bottom-6 md:right-6">
      {open ? (
        <section className="mb-4 flex h-[min(680px,calc(100svh-7rem))] w-[calc(100vw-2.5rem)] max-w-md flex-col overflow-hidden border border-navy/12 bg-paper shadow-lift md:w-[420px]">
          <header className="flex items-center justify-between gap-3 bg-navy p-4 text-paper">
            <div className="flex items-center gap-3">
              <WoohyukmonAvatar language={language} size="sm" />
              <div>
                <p className="text-base font-semibold">
                  {language === "ko" ? "우혁몬" : "Woohyukmon"}
                </p>
                <p className="text-xs text-paper/70">
                  {language === "ko" ? "행정 / 검색 / 아이디어" : "Admin / Search / Ideas"}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close Woohyukmon chat"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center border border-paper/25 text-paper transition hover:border-brass hover:bg-paper/10"
            >
              <Minus aria-hidden className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid gap-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" ? (
                    <WoohyukmonAvatar language={language} size="sm" />
                  ) : null}
                  <div
                    className={`max-w-[82%] whitespace-pre-wrap px-4 py-3 text-sm leading-7 ${
                      message.role === "user"
                        ? "bg-navy text-paper"
                        : "border border-navy/10 bg-white/78 text-ink"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <WoohyukmonAvatar language={language} size="sm" />
                  <span className="inline-flex items-center gap-2 border border-navy/10 bg-white/78 px-4 py-3">
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                    {language === "ko" ? "우혁몬이 생각 중입니다..." : "Woohyukmon is thinking..."}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {Array.from(new Set(quickPrompts)).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="border border-navy/12 bg-white/70 px-3 py-2 text-xs font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="border-t border-red-900/12 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
              {error}
            </div>
          ) : null}

          <form onSubmit={submit} className="flex gap-2 border-t border-navy/10 bg-white/60 p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={language === "ko" ? "우혁몬에게 물어보기" : "Ask Woohyukmon"}
              className="min-h-11 flex-1 border border-navy/14 bg-paper px-3 text-sm text-ink outline-none transition focus:border-brass focus:ring-2 focus:ring-brass/20"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="flex h-11 w-11 items-center justify-center bg-brass text-ink transition hover:bg-navy hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send aria-hidden className="h-4 w-4" />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group flex items-center gap-3 bg-navy p-2 pr-4 text-paper shadow-lift transition hover:-translate-y-1 hover:bg-ink"
        aria-label="Open Woohyukmon chat"
      >
        <WoohyukmonAvatar language={language} size="lg" />
        <span className="grid text-left">
                  <span className="text-sm font-semibold">
            {language === "ko" ? "우혁몬" : "Woohyukmon"}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-paper/70">
            <MessageCircle aria-hidden className="h-3 w-3" />
            {language === "ko" ? "AI 보조" : "AI Assistant"}
          </span>
        </span>
        {open ? <X aria-hidden className="h-4 w-4" /> : <Bot aria-hidden className="h-4 w-4" />}
      </button>
    </div>
  );
}
