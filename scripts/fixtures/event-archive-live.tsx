import React from "react";
import { createRoot } from "react-dom/client";
import { EventArchiveWorkspace } from "../../src/components/event-archive/EventArchiveWorkspace";
import { LanguageProvider, LanguageSwitcher } from "../../src/components/LanguageProvider";
import type { ArchiveAccess } from "../../src/lib/eventArchive/model";

declare global { interface Window { archiveOperatorView: ArchiveAccess } }
createRoot(document.getElementById("root")!).render(<LanguageProvider>
  <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-serif text-3xl font-semibold text-navy">Event Studio</h1><p className="mt-2 text-sm text-muted">실제 비공개 아카이브 · 로컬 읽기 전용</p></div><LanguageSwitcher /></header>
    <EventArchiveWorkspace access={window.archiveOperatorView} canCreate={false} />
  </main>
</LanguageProvider>);
