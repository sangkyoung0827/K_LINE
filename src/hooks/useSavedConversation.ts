"use client";
import { useEffect, useRef, useState } from "react";

export function useSavedConversation(email: string) {
  const owner = email.trim().toLowerCase();
  const chat = useRef({ owner, id: "" });
  const [warning, setWarning] = useState("");
  useEffect(() => { chat.current = { owner, id: "" }; setWarning(""); }, [owner]);
  return {
    warning,
    clearWarning: () => setWarning(""),
    async save(content: string, role: "user" | "assistant") {
      if (!owner || !content) return;
      try {
        if (chat.current.owner !== owner) return;
        if (!chat.current.id) {
          const response = await fetch("/api/woohyukmon/chats", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firstMessage: content, expectedUserId: owner }),
            signal: AbortSignal.timeout(4000)
          });
          if (!response.ok) throw new Error("Chat save failed");
          const data = await response.json();
          if (chat.current.owner !== owner) return;
          chat.current.id = data.chat.id;
        }
        const response = await fetch("/api/woohyukmon/messages", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: chat.current.id, content, role, model: "4", expectedUserId: owner }),
          signal: AbortSignal.timeout(4000)
        });
        if (!response.ok) throw new Error("Message save failed");
      } catch {
        setWarning("대화 기록을 저장하지 못했습니다. / This message could not be saved.");
      }
    }
  };
}
