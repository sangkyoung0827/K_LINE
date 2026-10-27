"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, RefreshCw, Globe, EyeOff } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { labApiPath, type LabReview, type LabReviewDetail } from "@/lib/coDevelopment/model";
import { ScopedPreview } from "./ScopedPreview";

const button = "inline-flex min-h-11 items-center gap-2 rounded border border-ink/20 px-3 text-sm disabled:opacity-40";
async function command<T>(body: Record<string, unknown>) {
  const response = await fetch(labApiPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result as T;
}
export function OwnerReviews() {
  const { language } = useLanguage(); const ko = language === "ko";
  const [items, setItems] = useState<LabReview[]>([]), [detail, setDetail] = useState<LabReviewDetail | null>(null);
  const [note, setNote] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const refresh = useCallback(async () => setItems(await command<LabReview[]>({ action: "review_queue" })), []);
  useEffect(() => { void refresh().catch(() => setError("검수 목록을 불러오지 못했습니다. / Could not load reviews.")); }, [refresh]);
  async function act(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); await refresh(); } catch (e) { setError(e instanceof Error && e.message === "REVISION_CONFLICT" ? (ko ? "버전이 바뀌었습니다. 최신 제출물을 다시 확인해주세요." : "The version changed. Reload the submission.") : (ko ? "처리하지 못했습니다. 다시 확인해주세요." : "Could not complete the action.")); } finally { setBusy(false); }
  }
  const selected = items.find(i => i.id === detail?.review.id);
  const current = Boolean(selected && selected.current_revision === selected.revision);
  const released = Boolean(selected?.active && selected.published_revision_id === selected.revision_id);
  const stateLabel = (state: LabReview["state"]) => ({ pending: ko ? "검수 대기" : "Pending", approved: ko ? "승인됨" : "Approved", rejected: ko ? "반려됨" : "Rejected" })[state];
  return <section className="space-y-4 border-t border-ink/20 pt-5" aria-label={ko ? "소유자 검수" : "Owner review"}>
    <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{ko ? "제출된 프로젝트" : "Submitted projects"}</h2><button title={ko ? "검수 새로고침" : "Refresh reviews"} aria-label={ko ? "검수 새로고침" : "Refresh reviews"} className={button} disabled={busy} onClick={() => void act(refresh)}><RefreshCw size={18} /></button></div>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {!items.length && <p className="text-sm text-muted">{ko ? "제출된 프로젝트가 없습니다." : "No submitted projects."}</p>}
    <ul className="divide-y divide-ink/15">{items.map(item => <li key={item.id}><button className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 py-3 text-left" disabled={busy} onClick={() => void act(async () => { setDetail(await command<LabReviewDetail>({ action: "review_detail", id: item.id })); setNote(""); setChecked(false); })}><span className="break-words font-semibold">{item.title} · v{item.revision}</span><span className="text-sm">{stateLabel(item.state)} {item.current_revision !== item.revision ? (ko ? "· 변경됨" : "· Changed") : ""}</span></button></li>)}</ul>
    {detail && selected && <div className="min-w-0 space-y-4">
      <h3 className="break-words text-lg font-semibold">{detail.revision.title} · v{detail.revision.revision}</h3>
      <p className="whitespace-pre-wrap break-words text-sm">{detail.revision.description}</p>
      <ScopedPreview key={detail.review.id} id={detail.review.id} review />
      <details><summary className="cursor-pointer py-2">{ko ? "코드·변경 비교" : "Code and changes"}</summary><div className="grid min-w-0 gap-3 lg:grid-cols-2"><label className="grid min-w-0 gap-2 text-sm">{ko ? "이전 공개 코드" : "Previous release"}<textarea readOnly value={detail.previousHtml || ""} aria-label="Previous release code" className="form-field h-64 font-mono text-xs" /></label><label className="grid min-w-0 gap-2 text-sm">{ko ? "제출 코드" : "Submitted code"}<textarea readOnly value={detail.revision.html} aria-label="Submitted code" className="form-field h-64 font-mono text-xs" /></label></div><pre className="mt-3 max-h-64 overflow-auto border border-ink/15 p-3 text-xs">{JSON.stringify({ source: detail.source, fixture: detail.revision.fixture }, null, 2)}</pre></details>
      <label className="grid gap-2 text-sm">{ko ? "검수 의견" : "Review notes"}<textarea className="form-field" rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />{ko ? "코드·기능·개인정보·권한을 확인했습니다." : "I reviewed code, functionality, privacy and permissions."}</label>
      <div className="flex flex-wrap gap-2">
        {selected.state === "pending" && <>{[true, false].map(approve => <button key={String(approve)} className={button} disabled={busy || !current || !checked || !note.trim()} onClick={() => void act(async () => { await command({ action: "review_decide", id: detail.review.id, approve, note }); })}>{approve ? <Check size={17} /> : <X size={17} />}{approve ? (ko ? "승인" : "Approve") : (ko ? "반려" : "Reject")}</button>)}</>}
        {selected.state === "approved" && <button className={button} disabled={busy || !current || !checked || released} onClick={() => { if (window.confirm(ko ? "이 제출 버전을 K_LINE 서비스 카드로 공개할까요?" : "Publish this exact revision as a K_LINE service card?")) void act(async () => { await command({ action: "release", id: detail.review.id, expectedVersion: selected.publication_version, publish: true }); }); }}><Globe size={17} />{released ? (ko ? "공개됨" : "Published") : (ko ? "카드 공개" : "Publish card")}</button>}
        {selected.active && selected.state === "approved" && selected.published_revision_id === selected.revision_id && <button className={button} disabled={busy} onClick={() => void act(async () => { await command({ action: "release", id: detail.review.id, expectedVersion: selected.publication_version, publish: false }); })}><EyeOff size={17} />{ko ? "공개 중지" : "Unpublish"}</button>}
      </div>
    </div>}
  </section>;
}
