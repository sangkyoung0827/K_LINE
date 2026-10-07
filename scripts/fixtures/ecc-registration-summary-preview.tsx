import React from "react";
import { createRoot } from "react-dom/client";
import { EccMemberRegistrationForm } from "../../src/components/EccMemberRegistrationForm";
import { LanguageProvider } from "../../src/components/LanguageProvider";

const params = new URLSearchParams(location.search);
const approved = params.get("state") !== "pending";
window.localStorage.setItem("k_line_site_language", params.get("language") === "en" ? "en" : "ko");

// This isolated UI fixture never sends requests to K_LINE or changes real data.
window.fetch = async (input, init) => {
  if (init?.method && init.method !== "GET") return Response.json({ error: "UI_PREVIEW_READ_ONLY" }, { status: 403 });
  const path = String(input);
  if (path === "/api/ecc/member-registration") return Response.json({ registration: {
    id: "local-preview", googleEmail: "long-local-preview-member-address@example.test", googleName: "테스트 회원", googleAvatarUrl: "",
    fullName: "테스트 회원", studentId: "202600001", departmentOrMajor: "Korean Culture and Literature", nationality: "Test Country", gender: "Other",
    kakaoDisplayName: "Local Preview", kakaoId: "preview-only", paymentConfirmed: approved, officialMember: approved,
    status: approved ? "approved" : "submitted", adminNote: "", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z"
  } });
  if (path === "/api/ecc/me") return Response.json({ isLoggedIn: true, isOfficialMember: approved, isAdmin: false });
  return Response.json({});
};

createRoot(document.getElementById("root")!).render(<LanguageProvider>
  <div className="border-b border-ink/10 px-5 py-3 text-xs text-ink/60">로컬 화면 확인용 샘플 · 실제 회원 데이터 변경 없음</div>
  <main className="mx-auto max-w-6xl px-4 py-6 md:px-8"><EccMemberRegistrationForm collapsibleMobileIntro /></main>
</LanguageProvider>);
