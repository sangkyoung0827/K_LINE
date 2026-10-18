import React from "react";
import { createRoot } from "react-dom/client";
import { GoogleFormsManager } from "../../src/components/google-forms/GoogleFormsManager";
import { LanguageProvider } from "../../src/components/LanguageProvider";
import { googleFormTemplates } from "../../src/lib/googleForms/templates";

createRoot(document.getElementById("root")!).render(<LanguageProvider>
  <p role="status" className="border-b border-brass/30 px-4 py-3 text-sm">ECC MT 연동 검증 전용 · 실제 OpenAI / Google · 로컬 격리 DB · 운영 배포 없음 · K_LINE 로그인 검증과 별개</p>
  <GoogleFormsManager initialAccess={{ email: "waterfallingsound0827@gmail.com", authenticated: true, canConnect: true, isReadOnly: false, manageableClubs: ["ecc"] }} templates={googleFormTemplates} />
</LanguageProvider>);
