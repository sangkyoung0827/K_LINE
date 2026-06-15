"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const visitorStorageKey = "kline.visitorId";

export function SiteVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) {
      return;
    }

    const visitorId = getOrCreateVisitorId();

    void fetch("/api/analytics/visit", {
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer,
        visitorId
      }),
      headers: {
        "Content-Type": "application/json"
      },
      keepalive: true,
      method: "POST"
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}

function getOrCreateVisitorId() {
  const existing = window.localStorage.getItem(visitorStorageKey);

  if (existing) {
    return existing;
  }

  const nextId =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(visitorStorageKey, nextId);
  return nextId;
}
