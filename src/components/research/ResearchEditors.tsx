"use client";
import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export function ResearchEditors() {
  const { language } = useLanguage();
  const ko = language === "ko";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return <details className="mt-6 border border-navy/15 bg-white p-4">
    <summary className="cursor-pointer text-sm font-semibold text-navy">{ko ? "교수님 · 연구 편집자 등록" : "Add a professor / research editor"}</summary>
    <p className="mt-3 text-sm leading-6 text-muted">{ko ? "본인이 확인한 K_LINE 로그인 이메일을 입력하세요. 연구 편집자는 아카이브의 모든 자료를 편집·공개·삭제할 수 있습니다. 한활 승인 회원은 별도 지정 없이 본인 자료를 등록할 수 있습니다." : "Enter the person's confirmed K_LINE login email. Research editors can edit, publish and delete all archive materials. Approved HANHWAL members can already register their own materials."}</p>
    <form className="mt-3 flex flex-wrap gap-2" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(""); setMessage("");
      try {
        const response = await fetch("/api/research/editors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        if (!response.ok) throw new Error(ko ? "편집자를 등록하지 못했습니다." : "Could not add editor.");
        setEmail(""); setMessage(ko ? "등록되었습니다. 해당 이메일로 로그인하면 자료를 등록할 수 있습니다." : "Added. Sign in with that email to register materials.");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed"); }
      finally { setBusy(false); }
    }}>
      <label className="grid flex-1 gap-1 text-sm text-navy">{ko ? "로그인 이메일" : "Login email"}<input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="form-field !rounded-md" /></label>
      <button disabled={busy} className="self-end bg-navy px-4 py-3 text-sm font-semibold text-white">{ko ? "편집자 등록" : "Add editor"}</button>
    </form>
    {message ? <p role="status" className="mt-3 text-sm text-emerald-800">{message}</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
  </details>;
}
