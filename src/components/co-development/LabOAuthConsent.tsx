"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

type Detail = { clientName: string; redirectUri: string; email: string };
export function LabOAuthConsent({ requestId }: { requestId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void fetch(`/api/co-development/oauth/consent?request=${encodeURIComponent(requestId)}`, { cache: "no-store", signal: abort.signal })
      .then(async response => { if (!response.ok) throw new Error(); setDetail(await response.json()); })
      .catch(() => { if (!abort.signal.aborted) setError("연결 요청이 만료되었습니다. ChatGPT에서 다시 연결하세요. / Connection expired. Reconnect from ChatGPT."); });
    return () => abort.abort();
  }, [requestId]);
  async function decide(approve: boolean) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/co-development/oauth/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: requestId, approve }) });
      if (!response.ok) throw new Error();
      const value = await response.json();
      window.location.assign(value.redirect);
    } catch { setError("연결하지 못했습니다. ChatGPT에서 다시 시도하세요. / Could not connect. Retry from ChatGPT."); setBusy(false); }
  }
  return <main className="mx-auto max-w-xl space-y-6 px-5 py-12 text-ink">
    <Link href="/co-development" className="text-sm underline">Developer Studio</Link>
    <h1 className="text-2xl font-semibold">개발 공간 연결 / Connect Your Workspace</h1>
    {detail ? <>
      <div className="space-y-3 border-y border-ink/15 py-5">
        <p className="font-semibold break-words">{detail.clientName}</p>
        <p className="break-all">{detail.email}</p>
        <p className="break-all text-xs text-muted">{detail.redirectUri}</p>
      </div>
      <p className="text-sm leading-6">본인 개발 공간의 프로젝트·코드·시험 데이터를 조회하고 수정할 수 있습니다. 저장한 결과물은 소유자가 검수할 수 있습니다.</p>
      <p className="text-sm leading-6">Read and edit projects, source and test data in your workspace. Saved work is visible to the owner for review.</p>
      <p className="text-sm leading-6 text-muted">운영 데이터·GitHub·배포 권한은 제공하지 않습니다. 검수 요청과 공개 승인은 K_LINE에서 별도로 진행합니다.<br />No production, repository or deployment access. Submission and publication remain separate.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => void decide(true)} className="inline-flex min-h-11 items-center gap-2 rounded border border-navy bg-navy px-5 py-2 font-semibold text-white disabled:opacity-50"><Check size={18} />연결 허용 / Allow</button>
        <button type="button" disabled={busy} onClick={() => void decide(false)} className="inline-flex min-h-11 items-center gap-2 rounded border border-ink/20 px-5 py-2 disabled:opacity-50"><X size={18} />취소 / Cancel</button>
      </div>
    </> : !error && <p role="status">연결 확인 중 / Checking connection…</p>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
  </main>;
}
