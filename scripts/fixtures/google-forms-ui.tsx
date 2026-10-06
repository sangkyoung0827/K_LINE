import React from "react";
import { createRoot } from "react-dom/client";
import { GoogleFormsManager } from "../../src/components/google-forms/GoogleFormsManager";
import { googleFormTemplates } from "../../src/lib/googleForms/templates";

createRoot(document.getElementById("root")!).render(<>
  <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-gray-900">
    UI 테스트 미리보기 · 가상 데이터 · 실제 Google 계정 연동 대기
  </div>
  <GoogleFormsManager
  initialAccess={{ email: "test-admin@example.test", authenticated: true, canConnect: false, isReadOnly: false, manageableClubs: ["ecc"] }}
  templates={googleFormTemplates}
/></>);
