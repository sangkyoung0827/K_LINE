import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { LanguageProvider, LanguageSwitcher } from "../../src/components/LanguageProvider";
import { HomeTrackSections } from "../../src/components/HomeTrackSections";
import { CoDevelopmentWorkspace } from "../../src/components/co-development/CoDevelopmentWorkspace";
import { canUseCoDevelopment, isLabOwner, labOwner, labCollaborator } from "../../src/lib/coDevelopment/model";
import { ScopedPreview } from "../../src/components/co-development/ScopedPreview";
import { LabOAuthConsent } from "../../src/components/co-development/LabOAuthConsent";

function Fixture() {
  const [email, setEmail] = useState("");
  useEffect(() => { void fetch("/__fixture/session").then(response => response.json()).then(data => setEmail(data.email)); }, []);
  if (location.pathname === "/co-development/connect") return <LanguageProvider><header className="border-b border-ink/15 bg-paper px-4 py-3 text-sm font-semibold">K_LINE · 격리 검증</header><LabOAuthConsent requestId={new URLSearchParams(location.search).get("request") || ""} /></LanguageProvider>;
  return <LanguageProvider><header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 bg-paper px-4 py-3"><span className="text-sm font-semibold">K_LINE · 격리 검증</span><nav aria-label="Local test account" className="flex flex-wrap gap-3 text-sm">{[[labCollaborator,"Yuki"],[labOwner,"소유자"],["member@example.test","일반회원"],["developer@example.test","다른 개발자"]].map(([value,label]) => <a key={value} href={`/__fixture/account?email=${encodeURIComponent(value)}`} aria-current={value===email?"true":undefined} className={value===email?"font-bold text-teal-800 underline":""}>{label}</a>)}</nav><LanguageSwitcher /></header>{location.pathname === "/co-development" ? <CoDevelopmentWorkspace owner={isLabOwner(email)} /> : location.pathname.startsWith("/services/") ? <ScopedPreview id={location.pathname.split("/").at(-1)!} /> : <main className="bg-paper py-8"><h1 className="mx-auto mb-5 max-w-7xl px-4 font-serif text-3xl">K_LINE</h1><HomeTrackSections showEventStudio={[labOwner,labCollaborator,"developer@example.test"].includes(email)} showCoDevelopment={canUseCoDevelopment(email)} /></main>}</LanguageProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
