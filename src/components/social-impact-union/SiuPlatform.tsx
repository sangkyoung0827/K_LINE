"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { CalendarDays, ClipboardList, Eye, EyeOff, Pencil, Plus, Search, Settings, Shield, Star, Users, X } from "lucide-react";
import { socialImpactUnion } from "@/data/socialImpactUnion";
import { canApply, siuDate, siuPath, siuRoles, type SiuAccess, type SiuActivity, type SiuDetail, type SiuMyItem, type SiuRole } from "@/lib/siu/model";
import { SiuActivityForm } from "./SiuActivityForm";
import { SiuCard, SiuConfirm, SiuErrorMessage, SiuLoading, SiuShell, siuButton, siuPrimary, siuInput, siuFetch, useSiuCopy } from "./SiuUI";

function useLoad<T>(url: string) {
  const { data: session } = useSession();
  const ownerEmail = session?.user?.email?.trim().toLowerCase() || "";
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setBusy(true); setData(null); setError("");
    siuFetch<T & { ownerEmail?: string }>(url, undefined, "GET", controller.signal).then((result) => {
      if (!url.includes("mode=public") && !url.includes("mode=current") && result.ownerEmail !== ownerEmail) throw new Error("LOGIN_REQUIRED");
      if (active) setData(result);
    })
      .catch((e) => { if (active) setError(e.message || "SERVICE_UNAVAILABLE"); })
      .finally(() => { clearTimeout(timer); if (active) setBusy(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [url, version, ownerEmail]);
  return { data, error, busy, reload: () => setVersion((v) => v + 1) };
}
function Login({ path }: { path: string }) {
  const { t } = useSiuCopy();
  return <Link className={siuPrimary} href={"/login?callbackUrl=" + encodeURIComponent(path)}>{t("Log in with Google", "Google 로그인")}</Link>;
}
type ListResponse = { activities: SiuActivity[]; nextOffset: number | null };
export function SiuActivityList({ mode = "public" }: { mode?: "public" | "current" | "admin" }) {
  const { t } = useSiuCopy();
  const [offset, setOffset] = useState(0);
  const { data, error, busy, reload } = useLoad<ListResponse>("/api/siu/activities?mode=" + mode + "&offset=" + offset);
  return <div>
    {busy && <SiuLoading />}<SiuErrorMessage error={error} retry={reload} />
    {data && <>{data.activities.length ? <div className="grid gap-4 sm:grid-cols-2">{data.activities.map((a) => <SiuCard activity={a} key={a.id} />)}</div> :
      <p className="border-y border-ink/10 py-8 text-sm text-muted">{t("No activities to display.", "표시할 활동이 없습니다.")}</p>}
      {mode !== "current" && <div className="mt-4 flex gap-2">
        {offset > 0 && <button className={siuButton} onClick={() => setOffset(Math.max(0, offset - 20))}>{t("Previous", "이전")}</button>}
        {data.nextOffset !== null && <button className={siuButton} onClick={() => setOffset(data.nextOffset!)}>{t("Next", "다음")}</button>}
      </div>}
    </>}
  </div>;
}
function SiuHomeAccess() {
  const { data } = useLoad<{ access: SiuAccess }>("/api/siu/access");
  const { t } = useSiuCopy();
  return <div className="my-4 flex flex-wrap gap-2"><Link className={siuButton} href={siuPath + "/my"}><ClipboardList className="h-4 w-4" />{t("My Activities", "내 활동")}</Link>
    {data?.access.isAdmin && <Link className={siuButton} href={siuPath + "/admin"}><Settings className="h-4 w-4" />{t("SIU Management", "SIU 관리")}</Link>}</div>;
}
export function SiuHomeSections() {
  const { t } = useSiuCopy();
  const { data: session } = useSession();
  return <>
    <section className="mt-12 border-t border-ink/15 pt-8">
      <p className="text-xs font-bold text-brass">CURRENT ACTIVITIES</p><h2 className="mb-5 mt-2 font-serif text-2xl font-semibold text-navy">{t("Current Activities", "현재 모집 중인 활동")}</h2>
      <SiuActivityList mode="current" /><SiuHomeAccess key={session?.user?.email || "guest"} />
      <Link className={siuButton} href={siuPath + "/activities"}>{t("View all activities", "모든 활동 보기")}</Link>
    </section>
    <section className="mt-8 border-t border-ink/15 pt-6">
      <p className="mb-4 text-sm leading-7 text-muted">{t("Have an activity in mind? Create it and bring people together.", "하고 싶은 활동이 없나요? 직접 만들어 사람들과 함께 시작해보세요.")}</p>
      <Link className={siuPrimary} href={siuPath + "/activities/create"}><Plus className="h-4 w-4" />{t("Create an activity", "활동 만들기")}</Link>
    </section>
  </>;
}
type Mode = "list" | "create" | "detail" | "my" | "admin";
export function SiuPlatform({ mode, id }: { mode: Mode; id?: string }) {
  const { data, status } = useSession();
  const { t } = useSiuCopy();
  const title = mode === "create" ? t("Create an activity", "활동 만들기") : mode === "my" ? t("My Activities", "내 활동") :
    mode === "admin" ? t("SIU Management", "SIU 관리") : t("Activities", "활동");
  return <SiuShell title={title}>{mode === "list" ? <SiuActivityList /> : status === "loading" ? <SiuLoading /> :
    <SiuAccountScreen key={(data?.user?.email || "guest") + mode + (id || "")} mode={mode} id={id} />}</SiuShell>;
}
function SiuAccountScreen({ mode, id }: { mode: Mode; id?: string }) {
  const result = useLoad<{ access: SiuAccess }>("/api/siu/access");
  if (result.busy) return <SiuLoading />;
  if (result.error) return <SiuErrorMessage error={result.error} retry={result.reload} />;
  const access = result.data!.access;
  if (mode === "detail") return <SiuActivityDetail id={id!} />;
  if (!access.authenticated) return <Login path={siuPath + (mode === "create" ? "/activities/create" : "/" + mode)} />;
  if (mode === "create") return access.isReadOnly ? <SiuErrorMessage error="READ_ONLY_DEVELOPER" /> : <SiuActivityForm />;
  if (mode === "my") return <SiuMyActivities readOnly={access.isReadOnly} />;
  if (mode === "admin") return access.isAdmin ? <SiuAdmin access={access} /> : <SiuErrorMessage error="FORBIDDEN" />;
  return null;
}
function SiuActivityDetail({ id }: { id: string }) {
  const result = useLoad<SiuDetail>("/api/siu/activities/" + id);
  const { ko, t } = useSiuCopy();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  async function act(action: string) {
    if (!result.data || busy) return;
    setBusy(true); setError("");
    try {
      const applicationAction = ["apply", "withdraw", "rate"].includes(action);
      await siuFetch("/api/siu/activities/" + id + (applicationAction ? "/applications" : ""),
        applicationAction ? { action: action === "withdraw" ? "cancel" : action, rating } :
          { action, updated_at: result.data.activity.updated_at }, applicationAction ? "POST" : "PATCH");
      setConfirm(null); result.reload();
    } catch (e) { setConfirm(null); setError(e instanceof Error ? e.message : "SERVICE_UNAVAILABLE"); }
    finally { setBusy(false); }
  }
  if (result.busy) return <SiuLoading />;
  if (result.error) return <SiuErrorMessage error={result.error} retry={result.reload} />;
  const { activity: a, access, application, canManage, canEdit } = result.data!;
  if (editing) return <SiuActivityForm activity={a} onSaved={() => { setEditing(false); result.reload(); }} onCancel={() => setEditing(false)} />;
  const applied = application?.status === "applied";
  const canRate = applied && application.rating === null && ["published", "closed"].includes(a.status) && Date.now() >= Date.parse(a.ends_at);
  return <div className="space-y-6 text-ink">
    <SiuCard activity={a} showDetails={false} />
    <section className="border-t border-ink/15 pt-5">
      <h2 className="text-lg font-bold">{t("About this activity", "활동 소개")}</h2>
      <p className="mt-3 whitespace-pre-wrap break-words text-base leading-8">{a.description}</p>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        {[[t("Ends (KST)", "종료 (한국 시간)"), siuDate(a.ends_at, ko)], [t("Fee", "참가비"), a.is_free ? t("Free", "무료") : (a.fee_krw || 0).toLocaleString() + " KRW"],
          [t("Address", "주소"), a.location_address], [t("Creator", "만든 사람"), a.creator_display_name],
          [t("Preparation", "준비물 · 안내"), a.preparation_notes], [t("Contact", "문의"), a.contact_note]].map(([label, value]) => value && <div key={label}><dt className="font-semibold text-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{value}</dd></div>)}
      </dl>
      {a.tags.length > 0 && <p className="mt-4 break-words text-sm text-muted">{a.tags.map((x) => "#" + x).join(" ")}</p>}
      <a className={siuButton + " mt-5"} href={a.open_chat_url || socialImpactUnion.openChatUrl} target="_blank" rel="noopener noreferrer">
        {a.open_chat_url ? t("Activity Open Chat", "활동 오픈채팅") : t("SIU community Open Chat", "SIU 커뮤니티 오픈채팅")}
      </a>
    </section>
    <section className="border-t border-ink/15 pt-5">
      {access.isReadOnly ? <SiuErrorMessage error="READ_ONLY_DEVELOPER" /> : !access.authenticated ? <Login path={siuPath + "/activities/" + id} /> :
        applied ? <div className="flex flex-wrap items-center gap-3"><p role="status" className="font-semibold">{t("Application saved", "신청 완료")}</p>
          {Date.now() < Date.parse(a.starts_at) && <button disabled={busy} className={siuButton} onClick={() => setConfirm("withdraw")}><X className="h-4 w-4" />{t("Cancel application", "신청 취소")}</button>}</div> :
          <button disabled={busy || !canApply(a)} className={siuPrimary} onClick={() => setConfirm("apply")}><Plus className="h-4 w-4" />{canApply(a) ? t("Apply", "신청하기") : t("Applications closed / full", "신청 마감 · 정원 마감")}</button>}
      {application?.rating && <p className="mt-4 flex items-center gap-2 text-sm"><Star className="h-4 w-4 fill-brass text-brass" />{t("Your rating", "내 별점")}: {application.rating} / 5</p>}
      {canRate && !access.isReadOnly && <div className="mt-6">
        <h3 className="text-lg font-bold">{t("How was this activity?", "이번 활동은 어땠나요?")}</h3>
        <div className="my-3 flex gap-1" role="group" aria-label={t("Activity rating", "활동 별점")}>{[1, 2, 3, 4, 5].map((n) => <button key={n} className="flex h-11 w-11 items-center justify-center" disabled={busy} aria-label={n + t(" stars", "점")} aria-pressed={rating === n} onClick={() => setRating(n)}>
          <Star className={"h-7 w-7 " + (n <= rating ? "fill-brass text-brass" : "text-ink/30")} /></button>)}</div>
        <button className={siuPrimary} disabled={!rating || busy} onClick={() => setConfirm("rate")}>{t("Save rating", "별점 저장")}</button>
      </div>}
      <SiuErrorMessage error={error} retry={result.reload} />
    </section>
    {canManage && <section className="border-t border-ink/15 pt-5">
      <h2 className="mb-4 text-xl font-bold">{t("Activity management", "활동 관리")}</h2>
      {!access.isReadOnly && <div className="mb-5 flex flex-wrap gap-2">
        {canEdit && <button className={siuButton} onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />{t("Edit", "수정")}</button>}
        {a.status === "published" && <button className={siuButton} onClick={() => setConfirm("close")}><CalendarDays className="h-4 w-4" />{t("Close applications", "모집 마감")}</button>}
        {!["cancelled", "hidden"].includes(a.status) && <button className={siuButton} onClick={() => setConfirm("cancel")}><X className="h-4 w-4" />{t("Cancel activity", "활동 취소")}</button>}
        {access.isAdmin && <button className={siuButton} onClick={() => setConfirm(a.status === "hidden" ? "unhide" : "hide")}>
          {a.status === "hidden" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}{a.status === "hidden" ? t("Unhide", "숨김 해제") : t("Hide", "숨김")}</button>}
      </div>}
      <SiuApplicants id={id} />
    </section>}
    {confirm && <SiuConfirm busy={busy} title={({
      apply: t("Apply to this activity?", "이 활동에 신청하시겠습니까?"), withdraw: t("Cancel your application?", "신청을 취소하시겠습니까?"),
      rate: t("Save this rating?", "이 별점을 저장하시겠습니까?"), close: t("Close applications?", "모집을 마감하시겠습니까?"),
      cancel: t("Cancel this activity? Applications will remain on record.", "활동을 취소하시겠습니까? 신청 기록은 유지됩니다."),
      hide: t("Hide this activity from public view?", "활동을 공개 목록에서 숨기시겠습니까?"), unhide: t("Restore its previous visibility?", "숨김 이전 상태로 복원하시겠습니까?")
    } as Record<string, string>)[confirm]} onClose={() => setConfirm(null)} onConfirm={() => void act(confirm)} />}
  </div>;
}
function SiuApplicants({ id }: { id: string }) {
  const { t } = useSiuCopy();
  const [offset, setOffset] = useState(0);
  const result = useLoad<{ applicants: { id: string; display_name: string; status: string }[]; nextOffset: number | null }>("/api/siu/activities/" + id + "/applications?offset=" + offset);
  return <div><h3 className="font-semibold">{t("Applicants", "신청자")}</h3>{result.busy && <SiuLoading />}<SiuErrorMessage error={result.error} retry={result.reload} />
    {result.data && <><ul className="mt-3 divide-y divide-ink/10">{result.data.applicants.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="break-all">{p.display_name}</span><span className="text-muted">{p.status === "applied" ? t("Applied", "신청") : t("Cancelled", "취소")}</span></li>)}</ul>
      {!result.data.applicants.length && <p className="py-4 text-sm text-muted">{t("No applications yet.", "아직 신청자가 없습니다.")}</p>}
      <div className="flex gap-2">{offset > 0 && <button className={siuButton} onClick={() => setOffset(offset - 50)}>{t("Previous", "이전")}</button>}
        {result.data.nextOffset !== null && <button className={siuButton} onClick={() => setOffset(result.data!.nextOffset!)}>{t("Next", "다음")}</button>}</div>
    </>}
  </div>;
}
function SiuMyActivities({ readOnly }: { readOnly: boolean }) {
  const { t } = useSiuCopy();
  const [tab, setTab] = useState("applied");
  return <><div role="tablist" aria-label={t("My Activities", "내 활동")} className="mb-5 flex gap-2">
    {["applied", "created"].map((value) => <button role="tab" aria-selected={tab === value} className={tab === value ? siuPrimary : siuButton} key={value} onClick={() => setTab(value)}>{value === "applied" ? t("My applications", "내가 신청한 활동") : t("Created by me", "내가 만든 활동")}</button>)}
  </div><SiuMyList key={tab} tab={tab} readOnly={readOnly} /></>;
}
function SiuMyList({ tab, readOnly }: { tab: string; readOnly: boolean }) {
  const { t } = useSiuCopy();
  const [offset, setOffset] = useState(0);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const result = useLoad<{ items?: SiuMyItem[]; activities?: SiuActivity[]; nextOffset: number | null }>("/api/siu/my?tab=" + tab + "&offset=" + offset);
  const items = result.data?.items || result.data?.activities?.map((activity) => ({ activity, application: null })) || [];
  return <>{result.busy && <SiuLoading />}<SiuErrorMessage error={result.error} retry={result.reload} />
    {result.data && <>{!items.length && <p className="py-8 text-sm text-muted">{t("No activity records yet.", "아직 활동 기록이 없습니다.")}</p>}
      <div className="grid gap-5 sm:grid-cols-2">{items.map(({ activity, application }) => <div key={activity.id} className="min-w-0">
        <SiuCard activity={activity} />
        {application && <p className="mt-2 text-sm font-semibold">{application.status === "applied" ? t("Applied", "신청 완료") : t("Application cancelled", "신청 취소")}{application.rating ? " · " + application.rating + " / 5" : ""}</p>}
        {!readOnly && application?.status === "applied" && !application.rating && Date.now() < Date.parse(activity.starts_at) &&
          <button className={siuButton + " mt-2"} onClick={() => setCancelId(activity.id)}><X className="h-4 w-4" />{t("Cancel application", "신청 취소")}</button>}
        {tab === "created" && <Link className={siuButton + " mt-2"} href={siuPath + "/activities/" + activity.id}><Settings className="h-4 w-4" />{t("Manage / Edit", "관리 · 수정")}</Link>}
      </div>)}</div>
      <div className="mt-4 flex gap-2">{offset > 0 && <button className={siuButton} onClick={() => setOffset(offset - 20)}>{t("Previous", "이전")}</button>}
        {result.data.nextOffset !== null && <button className={siuButton} onClick={() => setOffset(result.data!.nextOffset!)}>{t("Next", "다음")}</button>}</div>
    </>}
    <SiuErrorMessage error={error} />
    {cancelId && <SiuConfirm title={t("Cancel your application?", "신청을 취소하시겠습니까?")} busy={saving} onClose={() => setCancelId(null)} onConfirm={async () => {
      setSaving(true); setError("");
      try { await siuFetch("/api/siu/activities/" + cancelId + "/applications", { action: "cancel" }); setCancelId(null); result.reload(); }
      catch (e) { setCancelId(null); setError((e as Error).message); } finally { setSaving(false); }
    }} />}
  </>;
}
function SiuAdmin({ access }: { access: SiuAccess }) {
  const { t } = useSiuCopy();
  const [tab, setTab] = useState("activities");
  const [sync, setSync] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <><div className="mb-6 grid gap-3 sm:grid-cols-2">
    <button className={siuButton} onClick={() => setTab("activities")} aria-pressed={tab === "activities"}><ClipboardList className="h-5 w-5" />{t("Activity Management", "활동 관리")}</button>
    <button className={siuButton} onClick={() => setTab("roles")} aria-pressed={tab === "roles"}><Shield className="h-5 w-5" />{t("Role Management", "권한 관리")}</button>
    <Link className={siuButton} href={siuPath}><Eye className="h-5 w-5" />{t("Open Public Page", "공개 페이지")}</Link>
    <Link className={siuButton} href={siuPath + "/my"}><Users className="h-5 w-5" />{t("My Activities", "내 활동")}</Link>
  </div>
    {tab === "activities" ? <SiuActivityList mode="admin" /> : <SiuRoles access={access} />}
    {!access.isReadOnly && <div className="mt-8 border-t border-ink/15 pt-5">
      <button disabled={busy} className={siuButton} onClick={async () => { setBusy(true); setError(""); try {
        const result = await siuFetch<{ attempted: number; synced: number }>("/api/siu/preferences/retry", {});
        setSync(result.synced + " / " + result.attempted + " " + t("synced", "동기화 완료"));
      } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{t("Retry pending preference signals", "미처리 선호도 신호 재시도")}</button>
      <p role="status" className="mt-2 text-sm">{sync}</p><SiuErrorMessage error={error} />
    </div>}
  </>;
}
function SiuRoles({ access }: { access: SiuAccess }) {
  const { ko, t } = useSiuCopy();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<SiuRole>("official_member");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const result = useLoad<{ roles: { email: string; role: SiuRole; updated_at: string }[]; nextOffset: number | null }>("/api/siu/roles?search=" + encodeURIComponent(query) + "&offset=" + offset);
  function searchRoles(e: FormEvent) { e.preventDefault(); setOffset(0); setQuery(search); }
  const labels = { user: t("User", "일반 사용자"), official_member: t("Official member", "정식회원"), admin: t("Admin", "관리자"), super_admin: t("Super admin", "최고 관리자"), developer: t("Developer", "개발자") };
  return <section className="space-y-5">
    <form onSubmit={searchRoles} className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-4 h-5 w-5 text-muted" />
        <input className={siuInput + " !pl-11"} aria-label={t("Search email", "이메일 검색")} placeholder={t("Search email", "이메일 검색")} value={search} maxLength={120} onChange={(e) => setSearch(e.target.value)} /></div>
      <button className={siuButton} aria-label={t("Search", "검색")}><Search className="h-5 w-5" /></button>
    </form>
    {result.busy && <SiuLoading />}<SiuErrorMessage error={result.error} retry={result.reload} />
    <ul className="divide-y divide-ink/15">{result.data?.roles.map((row) => <li key={row.email} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
      <div className="min-w-0"><p className="break-all font-semibold">{row.email}</p><p className="mt-1 text-xs text-muted">{labels[row.role]} · {siuDate(row.updated_at, ko)}</p></div>
      {!access.isReadOnly && row.email !== access.email && siuRoles.indexOf(row.role) < siuRoles.indexOf(access.role) &&
        <button className={siuButton} aria-label={t("Edit role", "권한 수정")} onClick={() => { setEmail(row.email); setRole(row.role); }}><Pencil className="h-4 w-4" /></button>}
    </li>)}</ul>
    {result.data?.roles.length === 0 && <p className="text-sm text-muted">{t("No role records.", "권한 기록이 없습니다.")}</p>}
    <div className="flex gap-2">{offset > 0 && <button className={siuButton} onClick={() => setOffset(offset - 50)}>{t("Previous", "이전")}</button>}
      {result.data?.nextOffset != null && <button className={siuButton} onClick={() => setOffset(result.data!.nextOffset!)}>{t("Next", "다음")}</button>}</div>
    {!access.isReadOnly && <form onSubmit={(e) => { e.preventDefault(); setConfirm(true); }} className="grid gap-3 border-t border-ink/15 pt-5">
      <label className="grid gap-2 text-sm font-semibold">{t("K_LINE account email", "K_LINE 계정 이메일")}<input className={siuInput} type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="grid gap-2 text-sm font-semibold">{t("Role", "권한")}<select className={siuInput} value={role} onChange={(e) => setRole(e.target.value as SiuRole)}>
        {(["user", "official_member", ...(access.isSuperAdmin ? ["admin"] : []), ...(access.isDeveloper ? ["super_admin"] : [])] as SiuRole[]).map((item) => <option key={item} value={item}>{labels[item]}</option>)}
      </select></label><button className={siuPrimary} disabled={busy}><Shield className="h-4 w-4" />{t("Save role", "권한 저장")}</button>
    </form>}
    <SiuErrorMessage error={error} />
    {confirm && <SiuConfirm busy={busy} title={email + " · " + labels[role] + " " + t("Save this SIU role?", "SIU 권한을 저장하시겠습니까?")} onClose={() => setConfirm(false)} onConfirm={async () => {
      setBusy(true); setError(""); try { await siuFetch("/api/siu/roles", { email, role }, "PATCH"); setConfirm(false); result.reload(); }
      catch (e) { setConfirm(false); setError((e as Error).message); } finally { setBusy(false); }
    }} />}
  </section>;
}
