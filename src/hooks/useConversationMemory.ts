"use client";
import { useEffect, useState } from "react";

export function useConversationMemory(email: string) {
  const owner = email.trim().toLowerCase();
  const key = `kline-conversation-memory:${owner}`;
  const [state, setState] = useState({ owner: "", enabled: false });
  useEffect(() => {
    const read = () => {
      let enabled = Boolean(owner);
      try { enabled = enabled && localStorage.getItem(key) !== "off"; } catch { /* Storage may be disabled. */ }
      setState({ owner, enabled });
    };
    read();
    const sync = (event: StorageEvent) => { if (event.key === key) read(); };
    const syncLocal = () => read();
    window.addEventListener("storage", sync);
    window.addEventListener("kline-conversation-memory-change", syncLocal);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("kline-conversation-memory-change", syncLocal);
    };
  }, [owner, key]);
  return {
    enabled: Boolean(owner) && state.owner === owner && state.enabled,
    setEnabled(enabled: boolean) {
      setState({ owner, enabled });
      try {
        localStorage.setItem(key, enabled ? "on" : "off");
        window.dispatchEvent(new Event("kline-conversation-memory-change"));
      } catch { /* Keep the in-memory preference. */ }
    }
  };
}
