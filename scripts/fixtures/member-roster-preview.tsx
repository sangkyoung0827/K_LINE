import React from "react";
import { createRoot } from "react-dom/client";
import { EccMemberRegistrationManagementPanel } from "../../src/components/EccMemberRegistrationManagementPanel";
import { HanhwalMemberRegistrationManagementPanel } from "../../src/components/HanhwalMemberRegistrationManagementPanel";
import { LanguageProvider, LanguageSwitcher } from "../../src/components/LanguageProvider";

const params = new URLSearchParams(location.search);
window.localStorage.setItem("k_line_site_language", params.get("language") === "en" ? "en" : "ko");
const hanhwal = params.get("club") === "hanhwal";
createRoot(document.getElementById("root")!).render(<LanguageProvider>
  <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3 text-xs text-ink/60">
    <span>로컬 검증용 명부 · 실제 회원 데이터 아님</span><LanguageSwitcher />
  </div>
  <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
    <h1 className="mb-6 font-serif text-3xl font-semibold">{hanhwal ? "한활" : "ECC"} 회원 관리</h1>
    {hanhwal ? <HanhwalMemberRegistrationManagementPanel /> : <EccMemberRegistrationManagementPanel />}
  </main>
</LanguageProvider>);
