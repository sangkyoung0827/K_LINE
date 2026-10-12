import React from "react";
import { createRoot } from "react-dom/client";
import { EventArchiveWorkspace } from "../../src/components/event-archive/EventArchiveWorkspace";
import { LanguageProvider, LanguageSwitcher } from "../../src/components/LanguageProvider";
import type { ArchiveAccess } from "../../src/lib/eventArchive/model";

const role = new URLSearchParams(location.search).get("role") || "admin";
const access: ArchiveAccess = { email: role === "member" ? "member@example.test" : "qa-admin@example.test",
  clubs: role === "member" ? [] : ["ecc", "hanhwal", "social_impact_union", "unclassified"],
  superAdmin: role !== "member", readOnly: role === "readonly" };
createRoot(document.getElementById("root")!).render(<LanguageProvider>
  <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-gray-900">
    LOCAL QA ONLY · isolated PostgreSQL and disk files · AI/Google mocked · no production access
  </div>
  <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
    <header className="flex items-center justify-between gap-4"><h1 className="font-serif text-3xl font-semibold text-navy">Event Studio</h1><LanguageSwitcher /></header>
    <EventArchiveWorkspace access={access} canCreate={role === "admin"} />
  </main>
</LanguageProvider>);
