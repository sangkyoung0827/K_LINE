import React from "react";
import { createRoot } from "react-dom/client";
import { EccResourceLibrary } from "../../src/components/EccResourceLibrary";
import { EccResourceDetail } from "../../src/components/EccResourceDetail";
import { LanguageProvider } from "../../src/components/LanguageProvider";

const params = new URLSearchParams(location.search);
const role = params.get("role") || "admin";
localStorage.setItem("k_line_site_language", params.get("language") === "en" ? "en" : "ko");
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set("x-preview-role", role);
  return originalFetch(input, { ...init, headers });
};
const id = location.pathname.match(/\/resources\/([a-f0-9-]+)$/)?.[1];

createRoot(document.getElementById("root")!).render(<LanguageProvider>
  <div className="border-b border-navy/10 px-4 py-3 text-xs text-muted">로컬 샘플 자료 · 운영 데이터와 분리된 화면 검증</div>
  {id ? <EccResourceDetail id={id} isAdmin={role === "admin"} /> : <EccResourceLibrary canUpload={role !== "public"} />}
</LanguageProvider>);
