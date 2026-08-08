"use client";

import { FolderPlus, Menu, MessageSquarePlus, Paperclip, PanelLeftClose, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

type GroundingSource = {
  title: string;
  url: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: GroundingSource[];
  status?: string;
  providers?: string[];
  sourceCount?: number;
  action?: {
    attachments: ChatAttachment[];
    boardId: "ecc" | "hanhwal";
    content: string;
    title: string;
    type: "publish_board_post";
  };
};

type ChatAttachment = {
  file: File;
  id: string;
  name: string;
  type: string;
};

type GeminiStreamEvent = {
  type?: "status" | "text" | "grounding" | "done" | "error";
  status?: string;
  label?: string;
  text?: string;
  groundingChunks?: GroundingSource[];
  providers?: string[];
  sourceCount?: number;
  webSearchQueries?: string[];
  error?: string;
};

type LiveKind = "applications" | "fund" | "members";

type SavedProject = {
  id: string;
  title: string;
  updated_at?: string;
};

type SavedChat = {
  id: string;
  project_id: string;
  title: string;
  last_message_at?: string;
};

type SavedMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: GroundingSource[] | null;
  status?: string | null;
  providers?: string[] | null;
};

type LocalBoardPostForAssistant = {
  author: string;
  boardId: "ecc" | "hanhwal";
  content: string;
  createdAt: string;
  id: string;
  title: string;
};

function readLocalBoardPostsForAssistant(): LocalBoardPostForAssistant[] {
  if (typeof window === "undefined") return [];

  const boardKeys = [
    { boardId: "ecc" as const, key: "k_line_free_board_ecc_posts" },
    { boardId: "hanhwal" as const, key: "k_line_free_board_hanhwal_posts" }
  ];

  return boardKeys.flatMap(({ boardId, key }) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];

      return parsed.slice(0, 30).flatMap((post) => {
        if (!post || typeof post !== "object") return [];
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
            createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt.slice(0, 80) : "",
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

function WoohyukmonAvatar({ spinning = false }: { spinning?: boolean }) {
  return (
    <span
      className={`flex h-8 w-14 shrink-0 items-center justify-center ${spinning ? "animate-spin" : ""}`}
      aria-hidden
    >
      <WoohyukmonGlassesIcon className="h-full w-full" />
    </span>
  );
}

function getCoreAnswer(message: string, language: "en" | "ko") {
  const normalized = message.toLowerCase().replace(/\s+/g, "").replace(/[?!.,~]/g, "");
  const asksEcc =
    normalized === "ecc가뭐야" ||
    normalized === "ecc가뭐예요" ||
    normalized === "ecc란" ||
    normalized === "whatiscec" ||
    normalized === "whatisecc";

  if (!asksEcc) return null;

  return language === "ko"
    ? "ECC는 English Conversation Club의 약자로, 전북대학교에서 한국 학생과 외국인 학생이 영어 회화와 다양한 교류 활동을 함께하는 국제교류 중심 동아리입니다. 영어를 공부하는 것뿐 아니라 친목 활동, 문화교류, 정기 모임과 여러 캠퍼스 활동을 통해 서로 자연스럽게 교류하는 것이 핵심입니다."
    : "ECC stands for English Conversation Club. It is a Jeonbuk National University student community where Korean and international students meet through English conversation, campus activities, friendship, and cultural exchange.";
}

function mergeSources(current: GroundingSource[], incoming: GroundingSource[]) {
  const sourceMap = new Map<string, GroundingSource>();

  for (const source of current) {
    if (source.url) sourceMap.set(source.url, source);
  }

  for (const source of incoming) {
    if (source.url && !sourceMap.has(source.url)) sourceMap.set(source.url, source);
  }

  return Array.from(sourceMap.values());
}

function mergeProviders(current: string[] = [], incoming: string[] = []) {
  return Array.from(new Set([...current, ...incoming].filter(Boolean)));
}

function parseNdjsonLine(line: string): GeminiStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as GeminiStreamEvent;
  } catch {
    return null;
  }
}

function fallbackStatusLabel(status: string | undefined, language: "en" | "ko") {
  if (language === "en") {
    if (status === "external_search_started") return "Searching external sources";
    if (status === "external_search_done") return "Search complete";
    if (status === "external_search_no_results") return "No strong web results found";
    if (status === "answer_stream_started") return "Woohyukmon is writing the answer";
    return "Working";
  }

  if (status === "external_search_started") return "외부 검색 중";
  if (status === "external_search_done") return "검색 완료";
  if (status === "external_search_no_results") return "검색 결과 부족";
  if (status === "answer_stream_started") return "우혁몬이 답변을 정리하는 중";
  return "처리 중";
}

function buildCompactStatus(message: ChatMessage, language: "en" | "ko") {
  const providers = message.providers?.length ? message.providers.join(" · ") : "";
  const sourceCount = message.sourceCount ?? message.sources?.length ?? 0;

  if (message.status) return message.status;

  if (providers && sourceCount > 0) {
    return language === "ko"
      ? `${providers} 검색 완료 · ${sourceCount}개 자료 참고`
      : `${providers} search complete · ${sourceCount} sources checked`;
  }

  return language === "ko" ? "우혁몬 준비 완료" : "Woohyukmon ready";
}

function cleanVisibleAnswer(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/(^|\n)\s*---+\s*(?=\n|$)/g, "$1")
    .replace(/\[\s*중략\s*\]/g, "")
    .replace(/중략[:：]?\s*/g, "")
    .replace(/\[\.\.\.\]/g, "");
}

function isPostInstruction(value: string) {
  return /게시물|게시글|업로드|올려s*줘|올려줘|post|publish/i.test(value);
}

function getLiveKind(value: string): LiveKind | null {
  const normalized = value.toLowerCase();
  if (/자금|잔액|남은 금액|fund|balance|donation/.test(normalized)) return "fund";
  if (/신청.*(현황|수|명단)|application.*(count|status)|신청자/.test(normalized)) return "applications";
  if (/회원.*(현황|수|명단)|member.*(count|status|summary)/.test(normalized)) return "members";
  return null;
}

function formatLiveSummary(kind: LiveKind, summary: Record<string, unknown>, language: "en" | "ko") {
  if (kind === "fund") {
    const balance = new Intl.NumberFormat(language === "ko" ? "ko-KR" : "en-US").format(
      Number(summary.displayedBalance ?? 0)
    );
    const donations = new Intl.NumberFormat(language === "ko" ? "ko-KR" : "en-US").format(
      Number(summary.totalDonationKrw ?? 0)
    );
    return language === "ko"
      ? `현재 ECC 자금관리의 표시 잔액은 ${balance}원이며, 누적 후원금은 ${donations}원입니다.`
      : `The current displayed ECC balance is KRW ${balance}, and total donations are KRW ${donations}.`;
  }
  if (kind === "applications") {
    const total = Number(summary.total ?? 0);
    const byActivity = (summary.byActivity ?? {}) as Record<string, number>;
    const detail = Object.entries(byActivity).map(([name, count]) => `${name}: ${count}`).join(", ");
    return language === "ko"
      ? `현재 활동 신청은 총 ${total}건입니다.${detail ? ` 활동별 현황: ${detail}` : ""}`
      : `There are ${total} activity applications in total.${detail ? ` By activity: ${detail}` : ""}`;
  }
  return language === "ko"
    ? `현재 가입 사용자 수는 ${Number(summary.registeredUsers ?? 0)}명, 정식회원은 ${Number(summary.officialMembers ?? 0)}명입니다.`
    : `There are ${Number(summary.registeredUsers ?? 0)} registered users and ${Number(summary.officialMembers ?? 0)} official members.`;
}

function postDraftFromAnswer(answer: string, fallback: string) {
  const titleMatch = answer.match(/^(?:제목|title)\s*[:：]\s*(.+)$/im);
  const title = (titleMatch?.[1] ?? fallback.split(/\n|\.|。/)[0] ?? "ECC post").trim().slice(0, 180);
  const body = answer
    .replace(/^(?:제목|title)\s*[:：].*$/im, "")
    .replace(/^(?:내용|content|body)\s*[:：]?\s*/im, "")
    .trim();
  return { content: body || fallback, title };
}

function reduceAssistantMessage(
  message: ChatMessage,
  event: GeminiStreamEvent,
  language: "en" | "ko"
) {
  if (event.type === "status") {
    return {
      ...message,
      status: event.label ?? fallbackStatusLabel(event.status, language),
      providers: mergeProviders(message.providers, event.providers),
      sourceCount: typeof event.sourceCount === "number" ? event.sourceCount : message.sourceCount
    };
  }

  if (event.type === "text" && event.text) {
    return {
      ...message,
      content: `${message.content}${cleanVisibleAnswer(event.text)}`,
      status:
        message.sourceCount && message.sourceCount > 0
          ? message.status
          : language === "ko"
            ? "우혁몬이 답변 중"
            : "Woohyukmon is answering"
    };
  }

  if ((event.type === "grounding" || event.type === "done") && event.groundingChunks) {
    return {
      ...message,
      sources: mergeSources(message.sources ?? [], event.groundingChunks),
      providers: mergeProviders(message.providers, event.providers),
      sourceCount:
        typeof event.sourceCount === "number"
          ? event.sourceCount
          : event.groundingChunks.length || message.sourceCount
    };
  }

  if (event.type === "done") {
    const count = message.sourceCount ?? message.sources?.length ?? 0;
    const providers = message.providers?.join(" · ");

    return {
      ...message,
      status:
        count > 0
          ? language === "ko"
            ? `${providers || "외부 검색"} 검색 완료 · ${count}개 자료 참고`
            : `${providers || "External search"} complete · ${count} sources checked`
          : language === "ko"
            ? "답변 완료"
            : "Answer complete"
    };
  }

  return message;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

export function WoohyukmonChatbot() {
  const { language } = useLanguage();
  const access = useSuperAdmin();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedChatId, setSelectedChatId] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelVersion, setModelVersion] = useState<"2" | "3">("2");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [saveWarning, setSaveWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeAssistantId, setActiveAssistantId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSentAtRef = useRef(0);

  const apiHistory = useMemo(
    () => messages.map((message) => ({ role: message.role, content: message.content })),
    [messages]
  );

  const saveWarningText =
    saveWarning ||
    (!access.loading && !access.isLoggedIn
      ? language === "ko"
        ? "로그인하면 대화 기록을 저장할 수 있습니다."
        : "Log in to save your chat history."
      : "");

  const loadProjects = useCallback(async () => {
    if (!access.isLoggedIn) return [];

    setHistoryLoading(true);
    try {
      const data = await fetchJson<{ projects: SavedProject[] }>("/api/woohyukmon/projects");
      setProjects(data.projects ?? []);
      setSelectedProjectId((current) => current || data.projects?.[0]?.id || "");
      setSaveWarning("");
      return data.projects ?? [];
    } catch {
      setSaveWarning(
        language === "ko"
          ? "저장된 대화 기록을 불러오지 못했습니다. 임시 대화는 계속 가능합니다."
          : "Saved conversations could not load. Temporary chat still works."
      );
      return [];
    } finally {
      setHistoryLoading(false);
    }
  }, [access.isLoggedIn, language]);

  const loadChats = useCallback(
    async (projectId: string) => {
      if (!access.isLoggedIn || !projectId) return [];

      try {
        const data = await fetchJson<{ chats: SavedChat[] }>(
          `/api/woohyukmon/chats?projectId=${encodeURIComponent(projectId)}`
        );
        setChats(data.chats ?? []);
        return data.chats ?? [];
      } catch {
        setSaveWarning(
          language === "ko"
            ? "채팅 기록을 불러오지 못했습니다. 새 대화는 임시로 사용할 수 있습니다."
            : "Chat history could not load. You can continue with a temporary chat."
        );
        return [];
      }
    },
    [access.isLoggedIn, language]
  );

  const loadMessages = useCallback(
    async (chatId: string) => {
      if (!access.isLoggedIn || !chatId) return;

      setHistoryLoading(true);
      try {
        const data = await fetchJson<{ messages: SavedMessage[] }>(
          `/api/woohyukmon/messages?chatId=${encodeURIComponent(chatId)}`
        );
        setMessages(
          (data.messages ?? [])
            .flatMap((message) => {
              if (message.role !== "user" && message.role !== "assistant") {
                return [];
              }

              return [
                {
                  id: message.id,
                  role: message.role,
                  content: message.content,
                  sources: message.sources ?? undefined,
                  status: message.status ?? undefined,
                  providers: message.providers ?? undefined,
                  sourceCount: message.sources?.length ?? undefined
                }
              ];
            })
        );
        setSaveWarning("");
      } catch {
        setSaveWarning(
          language === "ko"
            ? "이전 대화를 불러오지 못했습니다."
            : "Previous chat could not be loaded."
        );
      } finally {
        setHistoryLoading(false);
      }
    },
    [access.isLoggedIn, language]
  );

  useEffect(() => {
    if (access.loading) return;

    if (!access.isLoggedIn) {
      setProjects([]);
      setChats([]);
      setSelectedProjectId("");
      setSelectedChatId("");
      return;
    }

    void loadProjects();
  }, [access.loading, access.isLoggedIn, loadProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      void loadChats(selectedProjectId);
    }
  }, [selectedProjectId, loadChats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, activeAssistantId]);

  const updateAssistantMessage = (
    assistantId: string,
    updater: (message: ChatMessage) => ChatMessage
  ) => {
    setMessages((current) =>
      current.map((message) => (message.id === assistantId ? updater(message) : message))
    );
  };

  const applyStreamEvent = (assistantId: string, event: GeminiStreamEvent) => {
    if (event.type === "error") {
      throw new Error(
        event.error ??
          (language === "ko"
            ? "우혁몬 검색 응답 중 오류가 발생했습니다."
            : "Woohyukmon search response failed.")
      );
    }

    updateAssistantMessage(assistantId, (message) =>
      reduceAssistantMessage(message, event, language)
    );
  };

  const createProject = async () => {
    if (!access.isLoggedIn) {
      setSaveWarning(
        language === "ko"
          ? "프로젝트를 저장하려면 Google 로그인이 필요합니다."
          : "Google login is required to save a project."
      );
      return;
    }

    const title =
      window.prompt(language === "ko" ? "새 프로젝트 이름" : "New project name")?.trim() ||
      (language === "ko" ? "새 프로젝트" : "New Project");

    try {
      const data = await fetchJson<{ project: SavedProject }>("/api/woohyukmon/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      setProjects((current) => [data.project, ...current]);
      setSelectedProjectId(data.project.id);
      setSelectedChatId("");
      setMessages([]);
    } catch {
      setSaveWarning(language === "ko" ? "프로젝트를 저장하지 못했습니다." : "Project could not be saved.");
    }
  };

  const startNewChat = () => {
    setSelectedChatId("");
    setMessages([]);
    setSidebarOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 80);
  };

  const ensureChatForMessage = async (firstMessage: string) => {
    if (!access.isLoggedIn) return "";
    if (selectedChatId) return selectedChatId;

    let projectId = selectedProjectId;

    if (!projectId) {
      const loadedProjects = await loadProjects();
      projectId = loadedProjects[0]?.id ?? "";
    }

    if (!projectId) return "";

    const data = await fetchJson<{ chat: SavedChat }>("/api/woohyukmon/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstMessage, projectId })
    });

    setSelectedChatId(data.chat.id);
    setChats((current) => [data.chat, ...current.filter((chat) => chat.id !== data.chat.id)]);
    return data.chat.id;
  };

  const saveMessage = async (chatId: string, message: ChatMessage) => {
    if (!access.isLoggedIn || !chatId) return;

    try {
      await fetchJson("/api/woohyukmon/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          content: message.content,
          model: "gemini",
          providers: message.providers,
          role: message.role,
          sources: message.sources,
          status: message.status
        })
      });
      setSaveWarning("");
      if (selectedProjectId) void loadChats(selectedProjectId);
    } catch {
      setSaveWarning(
        language === "ko"
          ? "이번 대화를 저장하지 못했습니다. 대화 자체는 계속 사용할 수 있습니다."
          : "This message could not be saved. The chat still works locally."
      );
    }
  };

  const addAttachments = (files: FileList | File[]) => {
    const next = Array.from(files)
      .filter((file) => file.size > 0)
      .slice(0, 12)
      .map((file) => ({
        file,
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        type: file.type || "application/octet-stream"
      }));
    setAttachments((current) => [...current, ...next].slice(0, 12));
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  };

  const loadLiveSummary = async (kind: LiveKind) => {
    const data = await fetchJson<{ summary: Record<string, unknown> }>(
      `/api/woohyukmon/live?kind=${encodeURIComponent(kind)}`
    );
    return formatLiveSummary(kind, data.summary ?? {}, language);
  };

  const publishBoardPost = async (messageId: string, action: NonNullable<ChatMessage["action"]>) => {
    setLoading(true);
    setError("");
    try {
      const uploadPlan = await fetchJson<{
        uploads: Array<{ name: string; publicUrl: string; signedUrl: string; type: string }>;
      }>("/api/woohyukmon/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: action.attachments.map(({ name, type }) => ({ name, type })) })
      });
      await Promise.all(
        uploadPlan.uploads.map(async (upload, index) => {
          const attachment = action.attachments[index];
          const response = await fetch(upload.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": attachment.type },
            body: attachment.file
          });
          if (!response.ok) throw new Error("Attachment upload failed.");
        })
      );
      await fetchJson("/api/woohyukmon/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: action.boardId,
          content: action.content,
          media: uploadPlan.uploads.map(({ name, publicUrl, type }) => ({ name, type, url: publicUrl })),
          title: action.title
        })
      });
      updateAssistantMessage(messageId, (current) => ({
        ...current,
        action: undefined,
        content: `${current.content}\n\n${language === "ko" ? "ECC 게시판에 게시했습니다." : "Published to the ECC board."}`.trim()
      }));
      setAttachments([]);
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : language === "ko"
            ? "게시물을 업로드하지 못했습니다."
            : "The post could not be uploaded."
      );
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const now = Date.now();
    if (now - lastSentAtRef.current < 1200) return;
    lastSentAtRef.current = now;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");

    let chatId = "";
    try {
      chatId = await ensureChatForMessage(trimmed);
      await saveMessage(chatId, userMessage);
    } catch {
      setSaveWarning(
        language === "ko"
          ? "대화 저장 준비에 실패했습니다. 임시 대화로 계속 진행합니다."
          : "Could not prepare saved chat. Continuing as a temporary chat."
      );
    }

    const liveKind = modelVersion === "3" ? getLiveKind(trimmed) : null;
    if (liveKind) {
      try {
        const answer = await loadLiveSummary(liveKind);
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: answer,
          status: language === "ko" ? "실시간 K_LINE 정보 확인" : "Live K_LINE data checked"
        };
        setMessages((current) => [...current, assistantMessage]);
        await saveMessage(chatId, assistantMessage);
        return;
      } catch (liveError) {
        setError(
          liveError instanceof Error
            ? liveError.message
            : language === "ko"
              ? "실시간 정보를 불러오지 못했습니다."
              : "Live information could not be loaded."
        );
      }
    }

    const postIntent = modelVersion === "3" && attachments.length > 0 && isPostInstruction(trimmed);
    const attachmentsForPost = postIntent ? attachments : [];

    const coreAnswer = getCoreAnswer(trimmed, language);
    if (coreAnswer) {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: coreAnswer,
        status: language === "ko" ? "기본 안내 완료" : "Basic guidance complete"
      };
      setMessages((current) => [...current, assistantMessage]);
      await saveMessage(chatId, assistantMessage);
      window.setTimeout(() => inputRef.current?.focus(), 80);
      return;
    }

    const assistantId = `assistant-${Date.now()}`;
    let assistantSnapshot: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      sources: [],
      status: language === "ko" ? "검색 준비 중" : "Preparing search",
      providers: [],
      sourceCount: 0
    };

    setActiveAssistantId(assistantId);
    setMessages((current) => [...current, assistantSnapshot]);
    setLoading(true);

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentNames: attachmentsForPost.map((attachment) => attachment.name),
          message: trimmed,
          history: apiHistory.slice(-8),
          mode: postIntent ? "post_draft" : "chat",
          localBoardPosts: readLocalBoardPostsForAssistant()
        })
      });

      if (!response.ok || !response.body) {
        throw new Error(language === "ko" ? "답변을 생성하지 못했습니다." : "Could not generate an answer.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const event = parseNdjsonLine(line);
          if (event) {
            if (event.type === "error") {
              throw new Error(
                event.error ??
                  (language === "ko"
                    ? "우혁몬 검색 응답 중 오류가 발생했습니다."
                    : "Woohyukmon search response failed.")
              );
            }
            assistantSnapshot = reduceAssistantMessage(assistantSnapshot, event, language);
            applyStreamEvent(assistantId, event);
          }
        }
      }

      const lastEvent = parseNdjsonLine(buffer);
      if (lastEvent) {
        if (lastEvent.type === "error") {
          throw new Error(
            lastEvent.error ??
              (language === "ko"
                ? "우혁몬 검색 응답 중 오류가 발생했습니다."
                : "Woohyukmon search response failed.")
          );
        }
        assistantSnapshot = reduceAssistantMessage(assistantSnapshot, lastEvent, language);
        applyStreamEvent(assistantId, lastEvent);
      }

      assistantSnapshot = {
        ...assistantSnapshot,
        content:
          assistantSnapshot.content.trim().length > 0
            ? cleanVisibleAnswer(assistantSnapshot.content)
            : language === "ko"
              ? "답변을 생성하지 못했습니다. 다시 질문해 주세요."
              : "I could not generate an answer. Please try again."
      };

      if (postIntent) {
        const draft = postDraftFromAnswer(assistantSnapshot.content, trimmed);
        assistantSnapshot = {
          ...assistantSnapshot,
          action: {
            attachments: attachmentsForPost,
            boardId: "ecc",
            content: draft.content,
            title: draft.title,
            type: "publish_board_post"
          }
        };
      }

      updateAssistantMessage(assistantId, () => assistantSnapshot);
      await saveMessage(chatId, assistantSnapshot);
    } catch (requestError) {
      const fallbackMessage = {
        ...assistantSnapshot,
        status: language === "ko" ? "오류 발생" : "Error",
        content:
          assistantSnapshot.content.trim().length > 0
            ? cleanVisibleAnswer(assistantSnapshot.content)
            : language === "ko"
              ? "우혁몬이 잠시 대답하지 못했습니다. 잠시 후 다시 시도해 주세요."
              : "Woohyukmon could not answer for a moment. Please try again soon."
      };

      setError(
        requestError instanceof Error
          ? requestError.message
          : language === "ko"
            ? "잠시 후 다시 시도해 주세요."
            : "Please try again in a moment."
      );
      updateAssistantMessage(assistantId, () => fallbackMessage);
      await saveMessage(chatId, fallbackMessage);
    } finally {
      setLoading(false);
      setActiveAssistantId("");
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const isEmptyConversation = messages.length === 0;

  const chatComposer = (mode: "center" | "bottom") => (
    <form
      onSubmit={submit}
      onDragOver={(event) => {
        if (modelVersion === "3") event.preventDefault();
      }}
      onDrop={(event) => {
        if (modelVersion !== "3") return;
        event.preventDefault();
        addAttachments(event.dataTransfer.files);
      }}
      className={`relative flex w-full gap-2 ${
        mode === "center"
          ? "rounded-[1.1rem] border border-navy/14 bg-white p-2 shadow-[0_14px_34px_rgba(31,42,68,0.10)]"
          : "border-t border-navy/10 bg-white/82 p-3 md:p-4"
      }`}
    >
      {modelVersion === "3" ? (
        <>
          <input
            ref={attachmentInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,video/*,audio/*,application/pdf,text/*"
            onChange={(event) => {
              if (event.target.files) addAttachments(event.target.files);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => attachmentInputRef.current?.click()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-navy/12 bg-white text-navy transition hover:border-brass"
            aria-label={language === "ko" ? "파일 첨부" : "Attach files"}
          >
            <Paperclip aria-hidden className="h-4 w-4" />
          </button>
        </>
      ) : null}
      <input
        ref={inputRef}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={language === "ko" ? "우혁몬에게 무엇이든 물어보세요" : "Ask Woohyukmon anything"}
        className={`min-h-12 flex-1 bg-paper px-4 text-sm text-ink outline-none transition focus:ring-2 focus:ring-brass/20 ${
          mode === "center"
            ? "rounded-xl border border-transparent focus:border-brass"
            : "rounded-xl border border-navy/14 focus:border-brass"
        }`}
      />
      <div className="relative hidden shrink-0 sm:block">
        <button
          type="button"
          onClick={() => setModelMenuOpen((current) => !current)}
          className="flex h-12 items-center rounded-xl border border-navy/12 bg-white px-3 text-[11px] font-bold text-navy transition hover:border-brass"
          aria-expanded={modelMenuOpen}
          aria-label={language === "ko" ? "모델 설정" : "Model settings"}
        >
          {language === "ko" ? `우혁몬 ${modelVersion}.0` : `Woohyukmon ${modelVersion}.0`}
        </button>
        {modelMenuOpen ? (
          <div className="absolute bottom-[calc(100%+0.5rem)] right-0 z-20 w-44 rounded-lg border border-navy/12 bg-white p-2 text-xs text-ink shadow-lift">
            <p className="px-2 py-1 font-bold text-navy">
              {language === "ko" ? "현재 모델" : "Current model"}
            </p>
            <div className="rounded-md bg-brass/14 px-2 py-2 font-semibold">
              <button
                type="button"
                onClick={() => {
                  setModelVersion("2");
                  setModelMenuOpen(false);
                }}
                className={`w-full rounded-md px-2 py-1 text-left ${modelVersion === "2" ? "bg-brass/14" : "hover:bg-navy/6"}`}
              >
                {language === "ko" ? "우혁몬 2.0" : "Woohyukmon 2.0"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setModelVersion("3");
                  setModelMenuOpen(false);
                }}
                className={`mt-1 w-full rounded-md px-2 py-1 text-left ${modelVersion === "3" ? "bg-brass/14" : "hover:bg-navy/6"}`}
              >
                {language === "ko" ? "우혁몬 3.0" : "Woohyukmon 3.0"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={loading || !input.trim()}
        aria-label="Send message"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brass text-ink transition hover:bg-navy hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send aria-hidden className="h-4 w-4" />
      </button>
      {modelVersion === "3" && attachments.length > 0 ? (
        <div className="absolute left-2 right-2 top-[calc(100%+0.35rem)] z-20 flex flex-wrap gap-1 rounded-lg border border-navy/12 bg-white p-2 text-xs shadow-lift">
          {attachments.map((attachment) => (
            <span key={attachment.id} className="inline-flex max-w-full items-center gap-1 rounded-md bg-paper px-2 py-1 text-ink/72">
              <span className="max-w-32 truncate">{attachment.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                aria-label={`${attachment.name} remove`}
                className="text-ink/55 hover:text-red-700"
              >
                <X aria-hidden className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </form>
  );

  const sidebar = (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-navy/12 bg-[#f8f4eb] text-ink lg:w-72">
      <div className="flex items-center justify-between border-b border-navy/10 p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brass">
            {language === "ko" ? "저장된 대화" : "Saved Conversations"}
          </p>
          <p className="mt-1 text-lg font-semibold">Woohyukmon</p>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-navy/12 text-navy lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close chat history"
        >
          <PanelLeftClose aria-hidden className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-1 p-3">
        <button
          type="button"
          onClick={() => void createProject()}
          className="flex min-h-11 items-center justify-start gap-2 rounded-lg px-3 text-sm font-bold text-ink transition hover:bg-navy/8"
        >
          <FolderPlus aria-hidden className="h-4 w-4" />
          {language === "ko" ? "새 프로젝트" : "New Project"}
        </button>
        <button
          type="button"
          onClick={startNewChat}
          className="flex min-h-11 items-center justify-start gap-2 rounded-lg bg-navy px-3 text-sm font-bold text-paper transition hover:bg-navy/88"
        >
          <MessageSquarePlus aria-hidden className="h-4 w-4" />
          {language === "ko" ? "새 채팅" : "New Chat"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {!access.loading && !access.isLoggedIn ? (
          <div className="rounded-lg border border-navy/10 bg-white/60 p-3 text-sm leading-6 text-ink/68">
            {language === "ko"
              ? "로그인하면 대화 기록을 저장할 수 있습니다."
              : "Log in to save your chat history."}
          </div>
        ) : null}

        {historyLoading ? (
          <p className="px-1 py-3 text-sm text-ink/55">
            {language === "ko" ? "기록을 불러오는 중..." : "Loading history..."}
          </p>
        ) : null}

        {projects.map((project) => (
          <div key={project.id} className="mb-3">
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId(project.id);
                setSelectedChatId("");
                setMessages([]);
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition ${
                selectedProjectId === project.id
                  ? "bg-navy text-paper"
                  : "text-ink/82 hover:bg-navy/8"
              }`}
            >
              {project.title || "General"}
            </button>

            {selectedProjectId === project.id ? (
              <div className="mt-2 grid gap-1 pl-3">
                <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/42">
                  {language === "ko" ? "채팅 기록" : "Chat History"}
                </p>
                {chats.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-ink/55">
                    {language === "ko" ? "아직 저장된 채팅이 없습니다." : "No saved chats yet."}
                  </p>
                ) : null}
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => {
                      setSelectedChatId(chat.id);
                      setSidebarOpen(false);
                      void loadMessages(chat.id);
                    }}
                    className={`rounded-lg px-3 py-2 text-left text-xs font-semibold leading-5 transition ${
                      selectedChatId === chat.id
                        ? "bg-brass text-ink"
                        : "text-ink/66 hover:bg-navy/8 hover:text-ink"
                    }`}
                  >
                    {chat.title || "New Chat"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );

  return (
    <section className="flex w-full flex-col overflow-hidden border border-navy/12 bg-white/70 text-left shadow-[0_22px_60px_rgba(31,42,68,0.09)] lg:min-h-[680px] lg:flex-row">
      <div className="hidden lg:block">{sidebar}</div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-[80] bg-ink/40 backdrop-blur-sm lg:hidden">
          <div className="h-full max-w-[19rem] overflow-hidden shadow-lift">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-navy/10 bg-white/54 px-4 py-3 md:px-5">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-navy/12 bg-white/70 text-navy lg:hidden"
            aria-label="Open chat history"
          >
            <Menu aria-hidden className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">
              {selectedProject?.title || (language === "ko" ? "일반 프로젝트" : "General")}
            </p>
            <p className="text-xs text-muted">
              {selectedChatId
                ? language === "ko"
                  ? "이전 대화 선택됨"
                  : "Previous chat selected"
                : language === "ko"
                  ? "새 채팅"
                  : "New Chat"}
            </p>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            className="hidden min-h-10 items-center gap-2 rounded-lg border border-navy/12 bg-white/70 px-3 text-xs font-bold text-ink transition hover:border-brass md:inline-flex"
          >
            <MessageSquarePlus aria-hidden className="h-4 w-4" />
            {language === "ko" ? "새 채팅" : "New Chat"}
          </button>
        </div>

        <div className="min-h-[440px] flex-1 overflow-y-auto p-5 md:p-7">
          {isEmptyConversation ? (
            <div className="mx-auto flex min-h-[470px] w-full max-w-2xl flex-col items-center justify-center pb-8">
              <WoohyukmonGlassesIcon
                className="mb-7 h-20 w-40 md:h-24 md:w-48"
                alt={language === "ko" ? "우혁몬 안경" : "Woohyukmon glasses"}
              />
              <div className="w-full">{chatComposer("center")}</div>
            </div>
          ) : (
            <div className="grid gap-4">
              {messages.map((message) => {
                const isActiveAssistant = message.role === "assistant" && message.id === activeAssistantId;

                return (
                  <div
                    key={message.id}
                    className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" ? <WoohyukmonAvatar spinning={isActiveAssistant} /> : null}
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-7 ${
                        message.role === "user"
                          ? "bg-navy text-paper"
                          : "border border-navy/10 bg-white/84 text-ink"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className="mb-3 flex items-center gap-2 rounded-full border border-brass/35 bg-brass/10 px-3 py-1.5 text-[11px] font-bold text-navy">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isActiveAssistant ? "animate-pulse bg-brass" : "bg-navy/45"
                            }`}
                            aria-hidden
                          />
                          <span className="truncate">{buildCompactStatus(message, language)}</span>
                        </div>
                      ) : null}

                      <div className="whitespace-pre-wrap">
                        {message.content ||
                          (isActiveAssistant
                            ? language === "ko"
                              ? "검색하고 답변을 준비하고 있어요."
                              : "Searching and preparing an answer."
                            : "")}
                      </div>
                      {message.action?.type === "publish_board_post" ? (
                        <div className="mt-4 border-t border-navy/10 pt-3">
                          <p className="text-xs font-semibold text-ink/62">
                            {language === "ko"
                              ? `ECC 게시판 게시 초안 · 첨부 ${message.action.attachments.length}개`
                              : `ECC board draft · ${message.action.attachments.length} attachments`}
                          </p>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => void publishBoardPost(message.id, message.action!)}
                            className="mt-3 inline-flex min-h-10 items-center justify-center bg-navy px-4 text-xs font-bold text-paper transition hover:bg-brass hover:text-ink disabled:opacity-50"
                          >
                            {language === "ko" ? "ECC 게시판에 게시" : "Publish to ECC board"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {error ? (
          <div className="border-t border-red-900/12 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
            {error}
          </div>
        ) : null}

        {saveWarningText ? (
          <div className="border-t border-brass/20 bg-brass/10 px-4 py-3 text-xs font-semibold text-navy">
            {saveWarningText}
          </div>
        ) : null}

        {!isEmptyConversation ? chatComposer("bottom") : null}
      </div>
    </section>
  );
}
