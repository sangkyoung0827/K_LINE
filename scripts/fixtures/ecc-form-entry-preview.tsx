import React from "react";
import { createRoot } from "react-dom/client";
import { EccGoogleFormEntry } from "../../src/components/google-forms/EccGoogleFormEntry";

const scenario = new URLSearchParams(window.location.search).get("state") || "outage";
window.fetch = async (_input, init) => new Response(JSON.stringify(init?.method === "POST"
  ? { state: "unavailable", error: "화면 검증만 수행합니다. 실제 Google 권한은 부여하지 않았습니다." }
  : { state: scenario, title: "ECC International Gathering" }), {
  status: init?.method === "POST" ? 503 : 200,
  headers: { "Content-Type": "application/json" },
});

createRoot(document.getElementById("root")!).render(<>
  <div className="border-b border-amber-300 bg-amber-50 px-5 py-3 text-sm">화면 모의 검증 · 실제 권한 부여·운영 배포 없음</div>
  <EccGoogleFormEntry id="00000000-0000-0000-0000-000000000001" />
</>);
