"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save, X } from "lucide-react";
import { activityPreferenceTaxonomy } from "@/lib/activity-preferences/taxonomy";
import { siuPath, type SiuActivity, type SiuStatus } from "@/lib/siu/model";
import { siuButton, siuPrimary, siuInput, siuFetch, SiuErrorMessage, useSiuCopy } from "./SiuUI";

function localDate(value?: string | null) { return value ? new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16) : ""; }
export function SiuActivityForm({ activity, onSaved, onCancel }: { activity?: SiuActivity; onSaved?: () => void; onCancel?: () => void }) {
  const { ko, t } = useSiuCopy();
  const router = useRouter();
  const [free, setFree] = useState(activity?.is_free ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<string[]>(activity?.categories || []);
  const [status, setStatus] = useState<SiuStatus>(activity?.status || "draft");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    const date = (key: string) => form.get(key) ? new Date(form.get(key) + ":00+09:00").toISOString() : null;
    const number = (key: string) => form.get(key) ? Number(form.get(key)) : null;
    setBusy(true); setError("");
    try {
      const result = await siuFetch<{ id: string }>("/api/siu/activities" + (activity ? "/" + activity.id : ""), {
        action: "save", updated_at: activity?.updated_at,
        activity: { ...Object.fromEntries(form), categories, tags: String(form.get("tags") || "").split(",").map((x) => x.trim()).filter(Boolean),
          status, is_free: free, fee_krw: free ? 0 : number("fee_krw"), capacity: number("capacity"),
          starts_at: date("starts_at"), ends_at: date("ends_at"), application_deadline: date("application_deadline") }
      }, activity ? "PATCH" : "POST");
      if (onSaved) onSaved(); else router.push(siuPath + "/activities/" + result.id);
    } catch (e) { setError(e instanceof Error ? e.message : "SERVICE_UNAVAILABLE"); } finally { setBusy(false); }
  }
  const field = (name: keyof SiuActivity, en: string, kr: string, required = false, max = 200, type = "text") => <label className="grid min-w-0 gap-2 text-sm font-semibold">
    {t(en, kr)}{required && " *"}<input className={siuInput} name={name} type={type} required={required} maxLength={max} defaultValue={String(activity?.[name] ?? "")} />
  </label>;
  const area = (name: keyof SiuActivity, en: string, kr: string, required: boolean, max: number, rows: number) => <label className="grid gap-2 text-sm font-semibold">
    {t(en, kr)}{required && " *"}<textarea className={siuInput + " resize-y"} name={name} required={required} rows={rows} maxLength={max} defaultValue={String(activity?.[name] ?? "")} />
  </label>;
  return <form onSubmit={save} className="border-t border-ink/15 py-5 text-ink">
    <fieldset disabled={busy} className="grid min-w-0 gap-5">
      {field("title", "Title", "활동명", true, 120)}
      {area("short_description", "Short description", "한 줄 소개", true, 300, 2)}
      {area("description", "Description", "상세 설명", true, 10000, 6)}
      <fieldset><legend className="mb-3 text-sm font-semibold">{t("Categories *", "활동 분야 *")}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{activityPreferenceTaxonomy.map((c) => <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-ink/10 bg-white/40 px-3 py-2 text-sm">
          <input type="checkbox" checked={categories.includes(c.id)} onChange={(e) => setCategories(e.target.checked ? [...categories, c.id] : categories.filter((id) => id !== c.id))} className="h-5 w-5 shrink-0 accent-navy" />
          {ko ? c.labelKo : c.labelEn}</label>)}</div>
      </fieldset>
      <label className="grid gap-2 text-sm font-semibold">{t("Tags (comma separated, English)", "태그 (쉼표 구분, 영문)")}<input className={siuInput} name="tags" maxLength={650} defaultValue={activity?.tags.join(", ") || ""} /></label>
      {field("cover_image_url", "Cover image URL (optional)", "커버 이미지 URL (선택)", false, 2000, "url")}
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">{(["starts_at", "ends_at", "application_deadline"] as const).map((name) => <label key={name} className="grid min-w-0 gap-2 text-sm font-semibold">
        {name === "starts_at" ? t("Starts (KST) *", "시작 (한국 시간) *") : name === "ends_at" ? t("Ends (KST) *", "종료 (한국 시간) *") : t("Application deadline (KST)", "신청 마감 (한국 시간)")}
        <input className={siuInput} type="datetime-local" name={name} required={name !== "application_deadline"} defaultValue={localDate(activity?.[name])} />
      </label>)}</div>
      {field("location_name", "Location", "장소", true)}
      {field("location_address", "Address", "주소", false, 400)}
      <label className="grid gap-2 text-sm font-semibold">{t("Capacity (optional)", "정원 (선택)")}<input className={siuInput} type="number" min="1" max="100000" step="1" name="capacity" defaultValue={activity?.capacity || ""} /></label>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input className="h-5 w-5 accent-navy" type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} />{t("Free activity", "무료 활동")}</label>
      {!free && <label className="grid gap-2 text-sm font-semibold">{t("Fee (KRW) *", "참가비 (원) *")}<input className={siuInput} name="fee_krw" type="number" min="1" max="10000000" step="1" required defaultValue={activity?.fee_krw || ""} /></label>}
      {area("preparation_notes", "Preparation notes", "준비물 · 안내", false, 2000, 3)}
      {area("contact_note", "Contact note", "문의 안내", false, 500, 2)}
      {field("open_chat_url", "Activity Open Chat URL (optional)", "활동 오픈채팅 URL (선택)", false, 2000, "url")}
      <label className="grid gap-2 text-sm font-semibold">{t("Status", "상태")}
        <select className={siuInput} value={status} onChange={(e) => setStatus(e.target.value as SiuStatus)}>
          <option value="draft">{t("Draft", "임시저장")}</option><option value="published">{t("Published", "공개")}</option>
          {activity && <option value="closed">{t("Closed", "모집 마감")}</option>}
        </select>
      </label>
      <SiuErrorMessage error={error} />
      <div className="flex flex-wrap gap-2"><button type="submit" className={siuPrimary}><Save className="h-4 w-4" />{busy ? t("Saving…", "저장 중…") : t("Save changes", "변경내용 저장하기")}</button>
        {onCancel && <button type="button" className={siuButton} onClick={onCancel}><X className="h-4 w-4" />{t("Cancel", "취소")}</button>}
      </div>
    </fieldset>
  </form>;
}
