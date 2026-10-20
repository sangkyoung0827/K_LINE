import React from "react";
import { createRoot } from "react-dom/client";
import { ClubResourceLibrary } from "../../src/components/club-resources/ClubResourceLibrary";
import { ClubResourceDetail } from "../../src/components/club-resources/ClubResourceDetail";
import { LanguageProvider } from "../../src/components/LanguageProvider";
import "../../src/app/our-activities/hanhwal/resources/resources.css";
const params = new URLSearchParams(location.search), role = params.get("role") || "public";
localStorage.setItem("k_line_site_language", params.get("language") === "en" ? "en" : "ko");
const original = window.fetch.bind(window);
window.fetch = (input, init={}) => {const headers = new Headers(init.headers);headers.set("x-preview-role",role);return original(input,{...init,headers});};
const id = location.pathname.match(/\/resources\/([a-f0-9-]+)$/)?.[1];
createRoot(document.getElementById("root")!).render(<LanguageProvider>
  <p className="border-b p-3 text-xs">로컬 격리 검증 · {role} · 운영 자료에 저장되지 않습니다.</p>
  {id ? <ClubResourceDetail club="hanhwal" id={id} isAdmin={role==="admin"}/> : <ClubResourceLibrary club="hanhwal" canUpload={role!=="public"}/>}
</LanguageProvider>);
