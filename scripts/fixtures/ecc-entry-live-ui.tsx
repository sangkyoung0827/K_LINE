import React from "react";
import { createRoot } from "react-dom/client";
import { EccGoogleFormEntry } from "../../src/components/google-forms/EccGoogleFormEntry";

const root = document.getElementById("root")!;
createRoot(root).render(<>
  <div className="border-b border-amber-300 bg-amber-50 px-5 py-3 text-sm">비공개 신청 테스트 · 실제 Google 로그인·폼·DB · 운영 배포 없음</div>
  <nav className="mx-auto flex max-w-2xl flex-wrap gap-4 px-5 pt-5 text-sm">
    <a className="underline" href="/">정상 회원 조회</a>
    <a className="underline" href="/?scenario=outage">조회 오류 테스트</a>
    <a className="underline" href="/sign-in">테스트 계정 로그인</a>
  </nav>
  <EccGoogleFormEntry id={root.dataset.formId!} />
</>);
