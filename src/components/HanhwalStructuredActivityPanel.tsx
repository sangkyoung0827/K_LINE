"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ClipboardList, PackageCheck, Pencil, Plus, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import type {
  HanhwalCompetitionConfig,
  HanhwalEquipmentConfig,
  HanhwalStructuredActivity,
  HanhwalStructuredKind,
  HanhwalStructuredPayload,
  HanhwalStructuredResponse,
  HanhwalStructuredSubmission,
  HanhwalStructuredSummary,
  HanhwalUniformConfig
} from "@/lib/hanhwalStructuredTypes";
import {
  formatHanhwalKrw,
  hanhwalStructuredKinds,
  hanhwalStructuredLabels,
  isHanhwalStructuredOpen
} from "@/lib/hanhwalStructuredTypes";

type AdminDraft = {
  deadline: string;
  description: string;
  eventDate: string;
  feeKrw: string;
  itemName: string;
  kind: HanhwalStructuredKind;
  location: string;
  notes: string;
  optionLines: string;
  pickupInformation: string;
  pricingNote: string;
  status: "draft" | "open" | "closed";
  title: string;
  unitPriceKrw: string;
};

const emptyDraft: AdminDraft = {
  kind: "competition", title: "", description: "", eventDate: "", location: "",
  deadline: "", feeKrw: "", unitPriceKrw: "", pricingNote: "", itemName: "",
  pickupInformation: "", notes: "", status: "draft", optionLines: ""
};

function localDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function draftFromActivity(activity: HanhwalStructuredActivity): AdminDraft {
  let optionLines = "";
  if (activity.kind === "competition") {
    optionLines = (activity.configuration as HanhwalCompetitionConfig).divisions
      .map((row) => `${row.label}|${row.capacity ?? ""}|${row.description}`).join("\n");
  } else if (activity.kind === "equipment_order") {
    const config = activity.configuration as HanhwalEquipmentConfig;
    optionLines = [
      `itemType=${config.itemType}`,
      `minimumOrderUnit=${config.minimumOrderUnit ?? ""}`,
      `options=${config.availableOptions.join(",")}`,
      `colors=${config.featherColors.join(",")}`,
      `lengths=${config.lengths.join(",")}`,
      `weights=${config.weights.join(",")}`
    ].join("\n");
  } else {
    const config = activity.configuration as HanhwalUniformConfig;
    optionLines = `sizes=${config.sizes.join(",")}\nvariants=${config.variants.join(",")}`;
  }
  return {
    kind: activity.kind, title: activity.title, description: activity.description,
    eventDate: localDate(activity.eventDate), location: activity.location,
    deadline: localDate(activity.deadline), feeKrw: activity.feeKrw?.toString() ?? "",
    unitPriceKrw: activity.unitPriceKrw?.toString() ?? "", pricingNote: activity.pricingNote,
    itemName: activity.itemName, pickupInformation: activity.pickupInformation,
    notes: activity.notes, status: activity.status, optionLines
  };
}

function list(value = "") {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function configuration(draft: AdminDraft, existing?: HanhwalStructuredActivity) {
  if (draft.kind === "competition") {
    const previous = existing?.kind === "competition"
      ? (existing.configuration as HanhwalCompetitionConfig).divisions
      : [];
    return {
      divisions: draft.optionLines.split("\n").map((line, index) => {
        const [label = "", capacity = "", description = ""] = line.split("|").map((item) => item.trim());
        const matched = previous.find((row) => row.label === label) ?? previous[index];
        return { id: matched?.id || `division-${index + 1}`, label, capacity: capacity ? Number(capacity) : null, description };
      }).filter((row) => row.label)
    };
  }
  const entries = Object.fromEntries(draft.optionLines.split("\n").map((line) => {
    const index = line.indexOf("=");
    return index < 0 ? [line.trim(), ""] : [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
  if (draft.kind === "equipment_order") {
    return {
      itemType: entries.itemType || "arrow",
      minimumOrderUnit: entries.minimumOrderUnit ? Number(entries.minimumOrderUnit) : null,
      availableOptions: list(entries.options), featherColors: list(entries.colors),
      lengths: list(entries.lengths), weights: list(entries.weights)
    };
  }
  return { sizes: list(entries.sizes), variants: list(entries.variants) };
}

function AdminEditor({ activity, onSaved, onClose }: {
  activity?: HanhwalStructuredActivity;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { language } = useLanguage();
  const ko = language === "ko";
  const [draft, setDraft] = useState<AdminDraft>(() => activity ? draftFromActivity(activity) : emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof AdminDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/hanhwal/structured-activities", {
        method: activity ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id: activity?.id, configuration: configuration(draft, activity) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed.");
      onSaved(); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Save failed."); }
    finally { setBusy(false); }
  };
  const optionHelp = draft.kind === "competition"
    ? (ko ? "부문명|정원(선택)|설명 형식으로 한 줄씩" : "One per line: division|capacity(optional)|description")
    : draft.kind === "equipment_order"
      ? "itemType=arrow\nminimumOrderUnit=\noptions=\ncolors=\nlengths=\nweights="
      : "sizes=S,M,L,XL\nvariants=";
  return (
    <form onSubmit={submit} className="border border-navy/15 bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-xl font-semibold text-navy">{activity ? (ko ? "모집 편집" : "Edit round") : (ko ? "새 모집 만들기" : "New round")}</h3>
        <button type="button" onClick={onClose} className="icon-button" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-ink">{ko ? "유형" : "Type"}<select disabled={Boolean(activity)} value={draft.kind} onChange={(e) => { const kind = e.target.value as HanhwalStructuredKind; setDraft((current) => ({ ...current, kind, optionLines: kind === "equipment_order" ? "itemType=arrow\nminimumOrderUnit=\noptions=\ncolors=\nlengths=\nweights=" : kind === "uniform_order" ? "sizes=\nvariants=" : "" })); }} className="mt-2 w-full border border-navy/20 bg-white p-3">{hanhwalStructuredKinds.map((kind) => <option key={kind} value={kind}>{ko ? hanhwalStructuredLabels[kind].ko : hanhwalStructuredLabels[kind].en}</option>)}</select></label>
        <label className="text-sm font-semibold text-ink">{ko ? "상태" : "Status"}<select value={draft.status} onChange={(e) => set("status", e.target.value)} className="mt-2 w-full border border-navy/20 bg-white p-3"><option value="draft">DRAFT</option><option value="open">OPEN</option><option value="closed">CLOSED</option></select></label>
        <label className="text-sm font-semibold text-ink sm:col-span-2">{ko ? "제목" : "Title"}<input required value={draft.title} onChange={(e) => set("title", e.target.value)} className="mt-2 w-full border border-navy/20 p-3" /></label>
        <label className="text-sm font-semibold text-ink sm:col-span-2">{ko ? "설명" : "Description"}<textarea value={draft.description} onChange={(e) => set("description", e.target.value)} className="mt-2 min-h-24 w-full border border-navy/20 p-3" /></label>
        <label className="text-sm font-semibold text-ink">{ko ? "행사일" : "Event date"}<input type="datetime-local" value={draft.eventDate} onChange={(e) => set("eventDate", e.target.value)} className="mt-2 w-full border border-navy/20 p-3" /></label>
        <label className="text-sm font-semibold text-ink">{ko ? "신청 마감" : "Deadline"}<input required type="datetime-local" value={draft.deadline} onChange={(e) => set("deadline", e.target.value)} className="mt-2 w-full border border-navy/20 p-3" /></label>
        <label className="text-sm font-semibold text-ink">{ko ? "장소" : "Location"}<input value={draft.location} onChange={(e) => set("location", e.target.value)} className="mt-2 w-full border border-navy/20 p-3" /></label>
        <label className="text-sm font-semibold text-ink">{ko ? "참가비" : "Fee"}<input type="number" min="0" value={draft.feeKrw} onChange={(e) => set("feeKrw", e.target.value)} className="mt-2 w-full border border-navy/20 p-3" /></label>
        {draft.kind !== "competition" && <><label className="text-sm font-semibold text-ink">{ko ? "품목명" : "Item name"}<input value={draft.itemName} onChange={(e) => set("itemName", e.target.value)} className="mt-2 w-full border border-navy/20 p-3" /></label><label className="text-sm font-semibold text-ink">{ko ? "단가" : "Unit price"}<input type="number" min="0" value={draft.unitPriceKrw} onChange={(e) => set("unitPriceKrw", e.target.value)} className="mt-2 w-full border border-navy/20 p-3" /></label><label className="text-sm font-semibold text-ink sm:col-span-2">{ko ? "가격 안내" : "Pricing note"}<input value={draft.pricingNote} onChange={(e) => set("pricingNote", e.target.value)} className="mt-2 w-full border border-navy/20 p-3" /></label><label className="text-sm font-semibold text-ink sm:col-span-2">{ko ? "수령 안내" : "Pickup"}<input value={draft.pickupInformation} onChange={(e) => set("pickupInformation", e.target.value)} className="mt-2 w-full border border-navy/20 p-3" /></label></>}
        <label className="text-sm font-semibold text-ink sm:col-span-2">{ko ? "선택 항목 설정" : "Options"}<span className="mt-1 block whitespace-pre-line text-xs font-normal text-muted">{optionHelp}</span><textarea required value={draft.optionLines} onChange={(e) => set("optionLines", e.target.value)} className="mt-2 min-h-32 w-full border border-navy/20 p-3 font-mono text-xs" /></label>
        <label className="text-sm font-semibold text-ink sm:col-span-2">{ko ? "추가 안내" : "Notes"}<textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} className="mt-2 min-h-20 w-full border border-navy/20 p-3" /></label>
      </div>
      {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{error}</p>}
      <button disabled={busy} className="mt-5 inline-flex min-h-11 items-center gap-2 bg-navy px-5 text-sm font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4" />{busy ? (ko ? "저장 중" : "Saving") : (ko ? "변경내용 저장" : "Save changes")}</button>
    </form>
  );
}

function selectField(label: string, value: string, choices: Array<{ label: string; value: string }>, setValue: (value: string) => void, required = false) {
  return <label className="text-sm font-semibold text-ink">{label}<select required={required} value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 w-full border border-navy/20 bg-white p-3"><option value="">-</option>{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>;
}

function MemberForm({ activity, existing, onSaved, adminCorrection = false }: { activity: HanhwalStructuredActivity; existing?: HanhwalStructuredSubmission; onSaved: () => void; adminCorrection?: boolean }) {
  const { language } = useLanguage(); const ko = language === "ko";
  const saved = (existing?.payload ?? {}) as Record<string, unknown>;
  const [payload, setPayload] = useState<Record<string, unknown>>({ quantity: 1, ...saved });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const set = (key: string, value: unknown) => setPayload((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/hanhwal/structured-submissions", { method: existing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: existing?.id, activityId: activity.id, payload }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Save failed."); onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Save failed."); } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!existing || !confirm(ko ? "신청을 취소하시겠습니까?" : "Cancel this submission?")) return;
    setBusy(true); setError("");
    try { const response = await fetch("/api/hanhwal/structured-submissions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: existing.id, action: "cancel" }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Cancel failed."); onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Cancel failed."); } finally { setBusy(false); }
  };
  const open = isHanhwalStructuredOpen(activity);
  const editable = adminCorrection || open;
  const equipment = activity.kind === "equipment_order"
    ? activity.configuration as HanhwalEquipmentConfig
    : null;
  const showArrowFields = equipment?.itemType === "arrow" || equipment?.itemType === "bow_and_arrow";
  if (!open && !existing) return null;
  return (
    <form onSubmit={submit} className="mt-5 grid gap-4 border-t border-navy/10 pt-5 sm:grid-cols-2">
      {activity.kind === "competition" && (activity.configuration as HanhwalCompetitionConfig).divisions.some((row) => row.description) && <div className="space-y-2 sm:col-span-2">{(activity.configuration as HanhwalCompetitionConfig).divisions.map((row) => row.description ? <p key={row.id} className="text-xs leading-5 text-muted"><b className="text-ink">{row.label}</b> {row.description}</p> : null)}</div>}
      {activity.kind === "competition" && selectField(ko ? "참가 부문" : "Division", String(payload.divisionId || ""), (activity.configuration as HanhwalCompetitionConfig).divisions.map((row) => ({ value: row.id, label: `${row.label}${row.capacity ? ` (${row.capacity})` : ""}` })), (value) => set("divisionId", value), true)}
      {activity.kind === "equipment_order" && <>
        {equipment && equipment.availableOptions.length > 0 && selectField(ko ? "품목 선택" : "Option", String(payload.option || ""), equipment.availableOptions.map((value) => ({ value, label: value })), (value) => set("option", value), true)}
        <label className="text-sm font-semibold text-ink">{ko ? "수량" : "Quantity"}<input required type="number" min="1" value={Number(payload.quantity || 1)} onChange={(e) => set("quantity", Number(e.target.value))} className="mt-2 w-full border border-navy/20 p-3" /></label>
        {showArrowFields && <label className="text-sm font-semibold text-ink">{ko ? "화살 각인 이름" : "Arrow print name"}<input value={String(payload.printText || "")} onChange={(e) => set("printText", e.target.value)} className="mt-2 w-full border border-navy/20 p-3" /></label>}
        {showArrowFields && equipment && equipment.featherColors.length > 0 && selectField(ko ? "깃 색상 1" : "Feather color 1", String(payload.featherColor1 || ""), equipment.featherColors.map((value) => ({ value, label: value })), (value) => set("featherColor1", value))}
        {showArrowFields && equipment && equipment.featherColors.length > 0 && selectField(ko ? "깃 색상 2" : "Feather color 2", String(payload.featherColor2 || ""), equipment.featherColors.map((value) => ({ value, label: value })), (value) => set("featherColor2", value))}
        {showArrowFields && equipment && equipment.lengths.length > 0 && selectField(ko ? "길이" : "Length", String(payload.length || ""), equipment.lengths.map((value) => ({ value, label: value })), (value) => set("length", value))}
        {showArrowFields && equipment && equipment.weights.length > 0 && selectField(ko ? "중량" : "Weight", String(payload.weight || ""), equipment.weights.map((value) => ({ value, label: value })), (value) => set("weight", value))}
      </>}
      {activity.kind === "uniform_order" && <>
        {selectField(ko ? "사이즈" : "Size", String(payload.size || ""), (activity.configuration as HanhwalUniformConfig).sizes.map((value) => ({ value, label: value })), (value) => set("size", value), true)}
        {(activity.configuration as HanhwalUniformConfig).variants.length > 0 && selectField(ko ? "옵션" : "Variant", String(payload.variant || ""), (activity.configuration as HanhwalUniformConfig).variants.map((value) => ({ value, label: value })), (value) => set("variant", value), true)}
        <label className="text-sm font-semibold text-ink">{ko ? "수량" : "Quantity"}<input required type="number" min="1" value={Number(payload.quantity || 1)} onChange={(e) => set("quantity", Number(e.target.value))} className="mt-2 w-full border border-navy/20 p-3" /></label>
      </>}
      <label className="text-sm font-semibold text-ink sm:col-span-2">{ko ? "요청사항" : "Note"}<textarea value={String(payload.note || "")} onChange={(e) => set("note", e.target.value)} className="mt-2 min-h-20 w-full border border-navy/20 p-3" /></label>
      {error && <p role="alert" className="text-sm font-semibold text-red-700 sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button disabled={busy || !editable} className="inline-flex min-h-11 items-center gap-2 bg-navy px-5 text-sm font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4" />{adminCorrection ? (ko ? "운영정보 수정" : "Correct details") : existing ? (ko ? "신청 수정" : "Update") : (ko ? "신청하기" : "Apply")}</button>
        {existing && open && !adminCorrection && <button type="button" disabled={busy} onClick={cancel} className="inline-flex min-h-11 items-center gap-2 border border-red-300 px-5 text-sm font-semibold text-red-700"><X className="h-4 w-4" />{ko ? "신청 취소" : "Cancel"}</button>}
      </div>
    </form>
  );
}

function AdminSummary({ activity, submissions, summary, onSaved }: { activity: HanhwalStructuredActivity; submissions: HanhwalStructuredSubmission[]; summary?: HanhwalStructuredSummary; onSaved: () => void }) {
  const { language } = useLanguage(); const ko = language === "ko";
  const [error, setError] = useState("");
  const update = async (id: string, field: string, value: string) => {
    setError("");
    try {
      const response = await fetch("/api/hanhwal/structured-submissions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, [field]: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Update failed.");
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Update failed.");
    }
  };
  return <div className="mt-5 border-t border-navy/10 pt-5">
    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3"><p><b>{summary?.submissionCount ?? 0}</b><br />{ko ? "신청자" : "Applicants"}</p><p><b>{summary?.totalQuantity ?? 0}</b><br />{ko ? "총 수량" : "Total quantity"}</p><p><b>{formatHanhwalKrw(summary?.estimatedTotalKrw ?? null) || "-"}</b><br />{ko ? "예상 합계" : "Estimated total"}</p></div>
    {summary?.breakdown.length ? <div className="mt-4 flex flex-wrap gap-2">{summary.breakdown.map((row) => <span key={row.id} className="border border-navy/15 bg-hanji/60 px-3 py-2 text-xs font-semibold">{row.label}: {row.count}{row.capacity ? ` / ${row.capacity}` : ""}</span>)}</div> : null}
    {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    <div className="mt-4 space-y-2">{submissions.filter((row) => row.status === "submitted").map((row) => <div key={row.id} className="grid gap-2 border border-navy/10 p-3 text-xs sm:grid-cols-[minmax(0,1fr)_150px_150px] sm:items-center"><div className="min-w-0"><b className="block truncate text-sm">{row.userName}</b><span className="break-all text-muted">{row.userEmail}</span><p className="mt-1 break-words text-ink/75">{Object.entries(row.payload).filter(([, value]) => value !== "").map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</p></div><select aria-label="Payment status" value={row.paymentStatus} onChange={(e) => update(row.id, "paymentStatus", e.target.value)} className="border border-navy/20 bg-white p-2"><option value="unconfirmed">{ko ? "결제 미확인" : "Unconfirmed"}</option><option value="confirmed">{ko ? "결제 확인" : "Confirmed"}</option></select>{activity.kind !== "competition" && <select aria-label="Fulfillment status" value={row.fulfillmentStatus || "ordered"} onChange={(e) => update(row.id, "fulfillmentStatus", e.target.value)} className="border border-navy/20 bg-white p-2"><option value="ordered">{ko ? "주문됨" : "Ordered"}</option><option value="ready">{ko ? "수령 준비" : "Ready"}</option><option value="received">{ko ? "수령 완료" : "Received"}</option></select>}<details className="sm:col-span-3"><summary className="cursor-pointer py-2 font-semibold text-navy">{ko ? "신청·주문 정보 수정" : "Correct application details"}</summary><MemberForm activity={activity} existing={row} adminCorrection onSaved={onSaved} /></details></div>)}</div>
  </div>;
}

export function HanhwalStructuredActivityPanel() {
  const { language } = useLanguage(); const ko = language === "ko";
  const [data, setData] = useState<HanhwalStructuredResponse>({ activities: [], submissions: [], summaries: {} });
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [editing, setEditing] = useState<HanhwalStructuredActivity | "new" | null>(null);
  const load = useCallback(async () => { setError(""); try { const response = await fetch("/api/hanhwal/structured-activities"); const next = await response.json(); if (!response.ok) throw new Error(next.error || "Load failed."); setData(next); } catch (reason) { setError(reason instanceof Error ? reason.message : "Load failed."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const activeSubmissions = useMemo(() => new Map((data.submissions || []).filter((row) => row.status === "submitted").map((row) => [row.activityId, row])), [data.submissions]);
  if (loading) return <p className="py-8 text-sm text-muted">{ko ? "추가 신청 정보를 불러오는 중입니다." : "Loading additional applications."}</p>;
  return <section className="mt-10 border-t border-navy/15 pt-8 sm:mt-14 sm:pt-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase text-brass">Hanhwal Operations</p><h2 className="mt-2 font-serif text-2xl font-semibold text-navy sm:text-4xl">{ko ? "대회 및 공동주문" : "Competition and Group Orders"}</h2></div>{data.canManage && <button onClick={() => setEditing("new")} className="inline-flex min-h-11 items-center gap-2 bg-navy px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" />{ko ? "새 모집" : "New round"}</button>}</div>
    {error && <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
    {editing && <div className="mt-6"><AdminEditor activity={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={load} /></div>}
    <div className="mt-6 space-y-8">{hanhwalStructuredKinds.map((kind) => {
      const activities = (data.activities || []).filter((row) => row.kind === kind);
      return <div key={kind}><h3 className="flex items-center gap-2 font-serif text-xl font-semibold text-navy sm:text-2xl">{kind === "competition" ? <CalendarDays className="h-5 w-5 text-brass" /> : kind === "equipment_order" ? <PackageCheck className="h-5 w-5 text-brass" /> : <ClipboardList className="h-5 w-5 text-brass" />}{ko ? hanhwalStructuredLabels[kind].ko : hanhwalStructuredLabels[kind].en}</h3>{activities.length === 0 ? <p className="mt-3 border-y border-navy/10 py-5 text-sm text-muted">{ko ? hanhwalStructuredLabels[kind].emptyKo : hanhwalStructuredLabels[kind].emptyEn}</p> : <div className="mt-3 grid gap-4">{activities.map((activity) => { const own = activeSubmissions.get(activity.id); const adminRows = (data.submissions || []).filter((row) => row.activityId === activity.id); return <article key={activity.id} className="border border-navy/12 bg-white p-4 shadow-soft sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`inline-flex px-2 py-1 text-xs font-bold ${isHanhwalStructuredOpen(activity) ? "bg-emerald-50 text-emerald-800" : "bg-hanji text-muted"}`}>{activity.status.toUpperCase()}</span><h4 className="mt-2 font-serif text-xl font-semibold text-navy sm:text-2xl">{activity.title}</h4></div>{data.canManage && <button onClick={() => setEditing(activity)} className="icon-button" aria-label="Edit"><Pencil className="h-4 w-4" /></button>}</div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/75">{activity.description}</p><dl className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-2"><div><dt className="font-bold text-ink">{ko ? "신청 마감" : "Deadline"}</dt><dd>{new Date(activity.deadline).toLocaleString(ko ? "ko-KR" : "en-US")}</dd></div>{activity.eventDate && <div><dt className="font-bold text-ink">{ko ? "행사일" : "Date"}</dt><dd>{new Date(activity.eventDate).toLocaleString(ko ? "ko-KR" : "en-US")}</dd></div>}{activity.location && <div><dt className="font-bold text-ink">{ko ? "장소" : "Location"}</dt><dd>{activity.location}</dd></div>}<div><dt className="font-bold text-ink">{ko ? "금액" : "Price"}</dt><dd>{formatHanhwalKrw(activity.feeKrw ?? activity.unitPriceKrw) || activity.pricingNote || "-"}</dd></div></dl>{activity.pickupInformation && <p className="mt-3 text-xs text-muted">{activity.pickupInformation}</p>}{activity.notes && <p className="mt-3 text-xs text-muted">{activity.notes}</p>}{own && <p className="mt-4 inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-800"><Check className="h-4 w-4" />{ko ? "신청 완료" : "Submitted"}<span className="text-xs font-medium text-muted">{own.paymentStatus === "confirmed" ? (ko ? "결제 확인" : "Payment confirmed") : (ko ? "결제 확인 대기" : "Payment pending")}{own.fulfillmentStatus ? ` · ${own.fulfillmentStatus}` : ""}</span></p>}{data.canManage ? <AdminSummary activity={activity} submissions={adminRows} summary={data.summaries?.[activity.id]} onSaved={load} /> : <MemberForm key={own?.updatedAt || "new"} activity={activity} existing={own} onSaved={load} />}</article>; })}</div>}</div>;
    })}</div>
  </section>;
}
