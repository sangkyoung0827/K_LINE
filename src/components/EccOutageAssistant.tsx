"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { I18nText } from "@/components/LanguageProvider";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";

export function EccOutageAssistant({ eligible }: { eligible: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [unpaid, setUnpaid] = useState(false);
  const [error, setError] = useState(false);
  async function enter() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/ecc/temporary-entry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: true }), signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error("Entry unavailable");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="paper-panel space-y-4 p-5 sm:p-8" aria-live="polite">
      <div className="flex items-center gap-3">
        <WoohyukmonGlassesIcon className="h-10 w-10" />
        <h2 className="text-xl font-semibold text-ink">Woohyukmon</h2>
      </div>
      <p><I18nText en="Membership lookup is temporarily unavailable after retrying." ko="자동 재시도 후에도 회원 권한을 조회하지 못했습니다." /></p>
      {eligible && !unpaid ? <>
        <p><I18nText en="Have you paid the ECC membership fee?" ko="ECC 회비를 납부하셨나요?" /></p>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={enter} className="min-h-11 rounded-md bg-ink px-5 py-2 text-paper disabled:opacity-50">
            <I18nText en={busy ? "Checking..." : "Yes, I have paid"} ko={busy ? "확인 중..." : "네, 납부했습니다"} />
          </button>
          <button type="button" disabled={busy} onClick={() => setUnpaid(true)} className="min-h-11 rounded-md border border-ink/30 px-5 py-2">
            <I18nText en="No, not yet" ko="아니요, 아직입니다" />
          </button>
        </div>
      </> : null}
      {unpaid ? <p><I18nText en="Please pay in cash at the location listed in the registration instructions, or pay by bank transfer using the account listed there." ko="등록 신청 설명에 안내된 장소에서 현금으로 납부하거나, 안내된 계좌로 회비를 이체해 주세요." /></p> : null}
      {error ? <p role="alert"><I18nText en="Entry could not be confirmed. Please check your account and try again." ko="입장을 확인하지 못했습니다. 로그인 계정을 확인하고 다시 시도해 주세요." /></p> : null}
      <div className="flex flex-wrap gap-4">
        <Link href="/ecc-join" className="underline underline-offset-4"><I18nText en="Payment instructions" ko="납부 장소·계좌 안내 보기" /></Link>
        <button type="button" disabled={busy} onClick={() => router.refresh()} className="underline underline-offset-4"><I18nText en="Check membership again" ko="권한 다시 확인" /></button>
      </div>
    </div>
  );
}
