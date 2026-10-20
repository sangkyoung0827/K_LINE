import React from "react";
import { createRoot } from "react-dom/client";
import { EventStudio } from "../../src/components/google-forms/EventStudio";
import { LanguageProvider, LanguageSwitcher } from "../../src/components/LanguageProvider";

createRoot(document.getElementById("root")!).render(<LanguageProvider>
  <div className="min-h-screen bg-paper text-ink">
    <p role="status" className="border-b border-brass/30 px-4 py-2 text-center text-xs">로컬 격리 검증 · AI와 Google은 모의 연동 · 운영 자료 변경 없음</p>
    <header className="flex items-center justify-between border-b border-ink/10 px-5 py-4"><a href="/" className="flex items-center gap-3 font-serif text-2xl font-semibold"><img src="/images/k-line-official-logo.png" alt="" className="h-10 w-10 object-contain" />K_LINE</a><LanguageSwitcher /></header>
    <main className="mx-auto max-w-6xl py-8 sm:py-12"><h1 className="px-4 font-serif text-4xl font-semibold sm:px-6">Event Studio</h1><EventStudio /></main>
  </div>
</LanguageProvider>);
