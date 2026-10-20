import React from "react";
import { createRoot } from "react-dom/client";
import { EventStudio } from "../../src/components/google-forms/EventStudio";
import { LanguageProvider, LanguageSwitcher } from "../../src/components/LanguageProvider";

createRoot(document.getElementById("root")!).render(<LanguageProvider>
  <div className="min-h-screen bg-paper text-ink">
    <p role="status" className="border-b border-brass/30 px-4 py-2 text-center text-sm">{process.env.STUDIO_PREVIEW_LIVE_AI === "true" ? "실제 OpenAI · 로컬 격리 DB · Google 생성 및 모집 게시 차단" : "로컬 UI 미리보기 · 실제 OpenAI·Google 미연결 · 자동 생성 실행 불가"}</p>
    <header className="flex items-center justify-between border-b border-ink/10 px-5 py-4"><a href="/" className="flex items-center gap-3 font-serif text-2xl font-semibold"><img src="/images/k-line-official-logo.png" alt="" className="h-10 w-10 object-contain" />K_LINE</a><LanguageSwitcher /></header>
    <main className="mx-auto max-w-6xl py-8 sm:py-12"><h1 className="px-4 font-serif text-4xl font-semibold sm:px-6">Event Studio</h1><EventStudio /></main>
  </div>
</LanguageProvider>);
