import React from "react";
import { createRoot } from "react-dom/client";
import { GoogleFormsManager } from "../../src/components/google-forms/GoogleFormsManager";
import { googleFormTemplates } from "../../src/lib/googleForms/templates";

createRoot(document.getElementById("root")!).render(<>
  <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-gray-900">
    비공개 연동 테스트 · 실제 Google Forms / Supabase · 운영 배포 없음
  </div>
  <GoogleFormsManager initialAccess={{ email: "waterfallingsound0827@gmail.com", authenticated: true, canConnect: false, isReadOnly: false, manageableClubs: ["ecc"] }} templates={googleFormTemplates} />
</>);
