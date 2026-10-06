"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";

type EntryState = "checking" | "login" | "eligible" | "unpaid" | "outage" | "unavailable" | "closed";

export function EccGoogleFormEntry({ id }: { id: string }) {
  const [state, setState] = useState<EntryState>("checking");
  const [title, setTitle] = useState("ECC 활동 신청 / Activity application");
  const [busy, setBusy] = useState(false);
  const [declaredUnpaid, setDeclaredUnpaid] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/google-forms/forms/${encodeURIComponent(id)}/entry`;

  const check = useCallback(async (signal?: AbortSignal) => {
    setState("checking"); setError(""); setDeclaredUnpaid(false);
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const data = await response.json();
      setState(["eligible", "unpaid", "outage", "unavailable", "closed", "login"].includes(data.state) ? data.state : "unavailable");
      if (data.title) setTitle(data.title);
    } catch { if (!signal?.aborted) setState("unavailable"); }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);
    return () => controller.abort();
  }, [check]);

  async function enter(paid = false) {
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paid }), signal: AbortSignal.timeout(30_000) });
      const data = await response.json();
      if (!response.ok || !["allowed", "temporary"].includes(data.state)) {
        setState(["unpaid", "outage", "unavailable", "closed", "login"].includes(data.state) ? data.state : "unavailable");
        throw new Error(data.error || "신청 권한을 확인하지 못했습니다. / Access could not be confirmed.");
      }
      // The server supplies only the registry's validated Google respondent URL.
      window.location.assign(data.url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Access unavailable"); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-2xl px-5 py-10">
    <h1 className="break-words text-2xl font-semibold">{title}</h1>
    <div className="mt-6 space-y-5" aria-live="polite">
      {state === "checking" ? <p>회원 권한 확인 중… / Checking membership…</p> : null}
      {state === "eligible" ? <button disabled={busy} onClick={() => void enter()} className="inline-flex min-h-12 items-center gap-2 bg-ink px-5 py-3 text-paper disabled:opacity-50">구글폼 열기 / Open form <ArrowRight className="h-4 w-4" /></button> : null}
      {state === "outage" ? <>
        <div className="flex items-center gap-3"><WoohyukmonGlassesIcon className="h-10 w-10" /><h2 className="text-xl font-semibold">Woohyukmon</h2></div>
        <p>자동 재시도 후에도 정식회원 권한을 조회하지 못했습니다.<br />Membership lookup is unavailable after retrying.</p>
        {!declaredUnpaid ? <>
          <p>ECC 회비를 납부하셨나요? 납부하셨다면 약 15분간 임시 접근을 요청할 수 있습니다.<br />Have you paid the ECC membership fee? If yes, you can request temporary access for about 15 minutes.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button disabled={busy} onClick={() => void enter(true)} className="min-h-12 bg-ink px-5 py-3 text-paper disabled:opacity-50">네, 납부했습니다 / Yes, I have paid</button>
            <button disabled={busy} onClick={() => setDeclaredUnpaid(true)} className="min-h-12 border border-ink/30 px-5 py-3">아니요, 아직입니다 / Not yet</button>
          </div>
        </> : null}
      </> : null}
      {state === "unpaid" || declaredUnpaid ? <>
        <p>회비 납부 및 정식회원 승인이 필요합니다. 등록 설명에 안내된 장소에서 현금으로 납부하거나 안내된 계좌로 이체해 주세요.<br />Payment and official membership approval are required. Please pay in cash at the location in the registration instructions or use the bank account listed there.</p>
        <Link href="/ecc-join" className="inline-block underline underline-offset-4">납부 장소·계좌 안내 / Payment instructions</Link>
      </> : null}
      {state === "closed" ? <p>현재 신청할 수 없는 활동입니다. / This application is not available.</p> : null}
      {state === "login" ? <Link href={`/login?callbackUrl=${encodeURIComponent(`/google-forms/ecc/${id}`)}`} className="underline">KLINE 가입에 사용한 Google 계정으로 로그인 / Sign in with your KLINE Google account</Link> : null}
      {state === "unavailable" ? <p>지금은 신청 접근을 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.<br />Access is unavailable. Please try again later.</p> : null}
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
      {!['checking', 'closed', 'login'].includes(state) ? <button disabled={busy} onClick={() => void check()} className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4"><RefreshCw className="h-4 w-4" />권한 다시 확인 / Retry</button> : null}
    </div>
  </section>;
}
