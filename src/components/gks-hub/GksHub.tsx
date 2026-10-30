"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, Check, ClipboardList, Download, ExternalLink, FilePenLine, GraduationCap, Save, Search } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { emptyGksDraft, findGksCountry, gksCountries, gksDocuments, gksProgress, gksWriterTitle, restoreGksDraft, validateGksWriter, type GksDraft } from "@/lib/gksHub/model";
import { schools, writerFields, type GksForm, type GksStage } from "@/lib/gksHub/reference";
import styles from "./GksHub.module.css";

const officialUrl = "https://www.studyinkorea.go.kr/ko/plan/gksNoticeRead.do?bbsId=BBSMSTR_000000000461&nttId=4420&stat=1";
type View = "overview" | "schools" | "documents" | "writer";

export function GksHub({ actorEmail, draftKey }: { actorEmail: string; draftKey: string }) {
  const { pick } = useLanguage();
  const t = (ko: string, en: string) => pick({ ko, en });
  const { data: session, status } = useSession();
  const active = status === "authenticated" && session?.user?.email?.trim().toLowerCase() === actorEmail;
  const [draft, setDraft] = useState<GksDraft>(emptyGksDraft);
  const [loadedKey, setLoadedKey] = useState("");
  const [view, setView] = useState<View>("overview");
  const [form, setForm] = useState<GksForm>("f2");
  const [countryInput, setCountryInput] = useState("");
  const [schoolQuery, setSchoolQuery] = useState("");
  const [docFilter, setDocFilter] = useState("all");
  const [docId, setDocId] = useState("f1");
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const countries = useMemo(gksCountries, []);

  useEffect(() => {
    if (!active) { setLoadedKey(""); setDraft(emptyGksDraft()); return; }
    let restored = emptyGksDraft();
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) restored = restoreGksDraft(JSON.parse(saved));
      setStorageError(false);
    } catch { setStorageError(true); }
    setDraft(restored);
    const country = countries.find(c => c.code === restored.country);
    setCountryInput(country ? `${country.ko} / ${country.en} (${country.code})` : "");
    setLoadedKey(draftKey);
  }, [active, draftKey, countries]);

  useEffect(() => {
    if (!active || loadedKey !== draftKey) return;
    const timer = setTimeout(() => {
      try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); setStorageError(false); }
      catch { setStorageError(true); }
    }, 400);
    return () => clearTimeout(timer);
  }, [active, loadedKey, draftKey, draft]);

  const update = (changes: Partial<GksDraft>) => setDraft(old => ({ ...old, ...changes }));
  const save = () => {
    try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); setStorageError(false); setMessage(t("이 탭에 초안을 저장했습니다.", "Draft saved in this tab.")); }
    catch { setStorageError(true); }
  };
  const updateDoc = (id: string, changes: Partial<{ stage: GksStage; note: string }>) => setDraft(old => ({ ...old,
    documents: { ...old.documents, [id]: { ...(old.documents[id] || { stage: "todo", note: "" }), ...changes } } }));
  const updateWriter = (id: string, value: string) => setDraft(old => ({ ...old, writer: { ...old.writer, [form]: { ...old.writer[form], [id]: value } } }));
  const downloadWord = async () => {
    const error = validateGksWriter(form, draft.writer[form]);
    if (error) { setMessage(error === "name" ? t("이름을 입력해 주세요.", "Enter your full name.") : t("한 항목 이상 작성해 주세요.", "Write at least one section.")); return; }
    setExporting(true); setMessage("");
    try {
      const response = await fetch("/api/gks-hub/access", { cache: "no-store" });
      const access = await response.json();
      if (!response.ok || !access.allowed || access.draftKey !== draftKey) throw new Error("ACCESS_DENIED");
      const { createGksWord } = await import("@/lib/gksHub/word");
      const blob = await createGksWord(form, draft.writer[form], draft.writerLanguage);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = draft.writer[form].fullName.trim().replace(/[^a-zA-Z0-9\u3131-\uD79D_-]+/g, "_").slice(0, 35);
      link.download = `GKS_${form === "f2" ? "Form2_Personal_Statement" : "Form3_Study_Plan"}_${safeName}.docx`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage(t("Word 초안을 다운로드했습니다.", "Word draft downloaded."));
    } catch { setMessage(t("다운로드하지 못했습니다. 로그인과 개발자 권한을 확인하고 다시 시도해 주세요.", "Download failed. Check your login and developer access, then try again.")); }
    finally { setExporting(false); }
  };

  if (!active || loadedKey !== draftKey) return <div className={styles.page}>
    <p role="status">{status === "unauthenticated" ? t("다시 로그인해 주세요.", "Please sign in again.") : t("접근 권한을 확인하고 있습니다.", "Checking access.")}</p>
    {status === "unauthenticated" && <Link href="/login?callbackUrl=/gks-hub">{t("로그인", "Sign in")}</Link>}
  </div>;

  const progress = gksProgress(draft);
  const catalog = gksDocuments(draft);
  const shownDocs = catalog.filter(d => docFilter === "all" || d.kind === docFilter);
  const selectedDoc = shownDocs.find(d => d.id === docId) || shownDocs[0];
  const docState = selectedDoc ? draft.documents[selectedDoc.id] : undefined;
  const writer = draft.writer[form];
  const chosenSchool = draft.school === "custom" ? draft.customUniversity : schools.find(s => s.id === draft.school)?.name;
  const views: { id: View; ko: string; en: string; icon: typeof GraduationCap }[] = [
    { id: "overview", ko: "준비 현황", en: "Overview", icon: GraduationCap }, { id: "schools", ko: "대학 선택", en: "Universities", icon: Search },
    { id: "documents", ko: "서류 체크리스트", en: "Checklist", icon: ClipboardList }, { id: "writer", ko: "Form 2 · 3 작성", en: "Form 2 · 3", icon: FilePenLine }
  ];

  return <div className={styles.page}>
    <Link href="/" className={styles.back}><ArrowLeft size={16} aria-hidden /> K_LINE</Link>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>{t("개발자 전용 테스트", "Developer-only test")}</p><h1>GKS Hub</h1></div>
      <a href={officialUrl} target="_blank" rel="noopener noreferrer" className={styles.source}><ExternalLink size={15} aria-hidden />{t("2026 공식 공고", "2026 official notice")}</a>
    </header>
    <nav className={styles.tabs} role="tablist" aria-label="GKS Hub">
      {views.map((item, index) => <button key={item.id} id={`gks-tab-${item.id}`} role="tab" tabIndex={view === item.id ? 0 : -1} aria-selected={view === item.id} aria-controls="gks-panel" onClick={() => { setView(item.id); setMessage(""); }} onKeyDown={event => {
        const next = event.key === "ArrowRight" ? (index + 1) % views.length : event.key === "ArrowLeft" ? (index + views.length - 1) % views.length : event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault(); setView(views[next].id); setMessage(""); document.getElementById(`gks-tab-${views[next].id}`)?.focus();
      }}><item.icon size={17} aria-hidden />{t(item.ko, item.en)}</button>)}
    </nav>
    <p className={styles.notice}>{t("2026년 참고자료 · 해당 연도 최종 요강과 대학별 요구사항을 다시 확인하세요. 공식 지원·파일 업로드는 하지 않습니다.", "2026 reference snapshot. Check the current guidelines and university requirements. No official application or file upload is performed.")}</p>
    <p role="status" className={storageError ? styles.error : styles.status}>{storageError ? t("브라우저 저장을 사용할 수 없습니다. 입력 내용은 현재 화면에만 유지됩니다.", "Browser storage is unavailable. Your edits remain on this screen only.") : message || t("테스트 초안은 계정별로 이 탭에만 저장됩니다. 민감한 개인정보는 입력하지 마세요.", "Test drafts stay in this tab, separated by account. Do not enter sensitive personal data.")}</p>

    <div role="tabpanel" id="gks-panel" aria-labelledby={`gks-tab-${view}`}>
      {view === "overview" && <>
        <div className={styles.summary}>
          <div><h2>{t("나의 준비 현황", "My preparation")}</h2><p>{chosenSchool || t("대학 미선택", "No university selected")}{draft.department && ` · ${draft.department}`}</p></div>
          <div><strong>{progress.ready} / {progress.total}</strong><span>{t("필수 서류 준비됨", "required documents ready")}</span><progress max={progress.total || 1} value={progress.ready} aria-label={t("서류 준비 현황", "Document progress")} /></div>
        </div>
        <section className={styles.profile}>
          <h2>{t("지원 준비 정보", "Preparation details")}</h2>
          <div className={styles.formGrid}>
            <label>{t("국적 검색", "Nationality search")}<input aria-label={t("국적 검색", "Nationality search")} list="gks-nationalities" autoComplete="off" value={countryInput} placeholder={t("국가명 또는 코드", "Country name or code")} onChange={e => { setCountryInput(e.target.value); update({ country: findGksCountry(e.target.value) }); }} onBlur={() => { if (countryInput.trim() && !findGksCountry(countryInput)) setMessage(t("국적은 검색 목록에서 선택해 주세요.", "Select a nationality from the search results.")); }} />
              <datalist id="gks-nationalities">{countries.map(c => <option key={c.code} value={`${c.ko} / ${c.en} (${c.code})`} />)}</datalist>
            </label>
            <label>{t("학위 과정", "Degree")}<select value={draft.degree} onChange={e => update({ degree: e.target.value as GksDraft["degree"] })}><option value="M">{t("석사", "Master's")}</option><option value="D">{t("박사", "Doctoral")}</option><option value="R">{t("연구과정", "Research")}</option></select></label>
            <label>{t("지원 전형", "Application track")}<select value={draft.track} onChange={e => update({ track: e.target.value as GksDraft["track"] })}><option value="University">{t("대학전형", "University track")}</option><option value="Embassy">{t("공관전형", "Embassy track")}</option></select></label>
          </div>
          <p className={styles.note}>{t("국가·지역 목록은 지원 자격 또는 합격 가능성을 의미하지 않습니다.", "The country/region list does not establish eligibility or a chance of admission.")}</p>
          <div className={styles.actions}><button onClick={save}><Save size={16} aria-hidden />{t("저장", "Save")}</button><button className={styles.primary} onClick={() => setView("documents")}><ClipboardList size={16} aria-hidden />{t("서류 준비", "Prepare documents")}</button></div>
        </section>
      </>}

      {view === "schools" && <section>
        <h2>{t("희망 대학 · 학과", "Target university and department")}</h2>
        <div className={styles.formGrid}>
          <label>{t("대학", "University")}<input value={draft.customUniversity} maxLength={160} placeholder="Korea University" onChange={e => update({ customUniversity: e.target.value })} /></label>
          <label>{t("학과", "Department")}<input value={draft.department} maxLength={160} placeholder="Media & Communication" onChange={e => update({ department: e.target.value })} /></label>
        </div>
        <div className={styles.actions}><button className={styles.primary} onClick={() => { if (!draft.customUniversity.trim()) { setMessage(t("대학 이름을 입력해 주세요.", "Enter a university name.")); return; } update({ school: "custom" }); setMessage(t("희망 대학을 선택했습니다.", "Target university selected.")); }}><Check size={16} aria-hidden />{t("이 대학 선택", "Select this university")}</button></div>
        <div className={styles.sectionTitle}><h3>{t("대학 예시", "University examples")}</h3><span>{t("모집 여부 별도 확인", "Check current recruitment")}</span></div>
        <label className={styles.search}>{t("대학 검색", "Search universities")}<input value={schoolQuery} onChange={e => setSchoolQuery(e.target.value)} /></label>
        <div className={styles.schoolList}>{schools.filter(s => `${s.name} ${s.eng} ${s.place}`.toLowerCase().includes(schoolQuery.trim().toLowerCase())).map(s => <button key={s.id} className={styles.school} aria-pressed={draft.school === s.id} onClick={() => update({ school: s.id })}><GraduationCap size={22} aria-hidden /><span><strong>{s.name}</strong><small>{s.eng} · {s.place}</small></span>{draft.school === s.id && <Check size={18} aria-hidden />}</button>)}</div>
        {!schools.some(s => `${s.name} ${s.eng} ${s.place}`.toLowerCase().includes(schoolQuery.trim().toLowerCase())) && <p>{t("검색 결과가 없습니다. 위에서 직접 입력할 수 있습니다.", "No results. You can enter another university above.")}</p>}
      </section>}

      {view === "documents" && <section>
        <div className={styles.sectionTitle}><h2>{t("서류 체크리스트", "Document checklist")}</h2><span>{progress.ready} / {progress.total} {t("필수 완료", "required ready")}</span></div>
        <div className={styles.formGrid}>
          <label>{t("학위 과정 선택", "Degree selection")}<select value={draft.degree} onChange={e => update({ degree: e.target.value as GksDraft["degree"] })}><option value="M">{t("석사", "Master's")}</option><option value="D">{t("박사", "Doctoral")}</option><option value="R">{t("연구과정", "Research")}</option></select></label>
          <label>{t("서류 분류", "Document category")}<select value={docFilter} onChange={e => setDocFilter(e.target.value)}><option value="all">{t("전체", "All")}</option><option value="required">{t("필수", "Required")}</option><option value="conditional">{t("해당 시", "Conditional")}</option><option value="optional">{t("선택", "Optional")}</option></select></label>
        </div>
        <div className={styles.documents}>
          <div className={styles.documentList} aria-label={t("서류 목록", "Document list")}>
            {shownDocs.map(doc => <button key={doc.id} aria-pressed={selectedDoc?.id === doc.id} onClick={() => setDocId(doc.id)}><span><strong>{doc.name}</strong><small>{doc.detail}</small></span>{draft.documents[doc.id]?.stage === "ready" && <Check size={17} aria-label={t("준비됨", "Ready")} />}</button>)}
          </div>
          {selectedDoc ? <section className={styles.docEditor}>
            <p className={styles.eyebrow}>{selectedDoc.detail}</p><h3>{selectedDoc.name}</h3><p>{selectedDoc.hint}</p>
            <ul>{selectedDoc.tips.map(tip => <li key={tip}>{tip}</li>)}</ul>
            <label>{t("준비 상태", "Preparation status")}<select value={docState?.stage || "todo"} onChange={e => updateDoc(selectedDoc.id, { stage: e.target.value as GksStage })}><option value="todo">{t("미준비", "Not started")}</option><option value="working">{t("수집 중", "In progress")}</option><option value="ready">{t("준비됨", "Ready")}</option></select></label>
            <label>{t("작성 메모", "Notes")}<textarea rows={5} value={docState?.note || ""} maxLength={5000} onChange={e => updateDoc(selectedDoc.id, { note: e.target.value })} /></label>
            <div className={styles.actions}><button onClick={save}><Save size={16} aria-hidden />{t("메모 저장", "Save notes")}</button>{(selectedDoc.id === "f2" || selectedDoc.id === "f3") && <button className={styles.primary} onClick={() => { setForm(selectedDoc.id as GksForm); setView("writer"); }}><FilePenLine size={16} aria-hidden />{t("Word 초안 작성", "Write Word draft")}</button>}</div>
          </section> : <p>{t("해당 서류가 없습니다.", "No documents in this category.")}</p>}
        </div>
      </section>}

      {view === "writer" && <section>
        <div className={styles.writerToolbar}>
          <div role="group" aria-label={t("서식 선택", "Form selection")}><button aria-pressed={form === "f2"} onClick={() => setForm("f2")}>Form 2</button><button aria-pressed={form === "f3"} onClick={() => setForm("f3")}>Form 3</button></div>
          <label>{t("문서 언어", "Document language")}<select value={draft.writerLanguage} onChange={e => update({ writerLanguage: e.target.value as "ko" | "en" })}><option value="en">English</option><option value="ko">한국어</option></select></label>
        </div>
        <div className={styles.writerLayout}>
          <section className={styles.writerEditor}>
            <h2>{form === "f2" ? t("자기소개서", "Personal statement") : t("학업계획서", "Study plan")}</h2>
            <label>{t("이름 · Full name", "Full name")}<input value={writer.fullName || ""} maxLength={120} onChange={e => updateWriter("fullName", e.target.value)} /></label>
            {writerFields[form].map(field => <label key={field.id}>{draft.writerLanguage === "ko" ? field.ko : field.en}<textarea rows={6} maxLength={20000} value={writer[field.id] || ""} onChange={e => updateWriter(field.id, e.target.value)} /></label>)}
            <div className={styles.actions}><button className={styles.primary} disabled={exporting} onClick={downloadWord}><Download size={16} aria-hidden />{exporting ? t("준비 중", "Preparing") : t("Word 다운로드", "Download Word")}</button><button onClick={save}><Save size={16} aria-hidden />{t("초안 저장", "Save draft")}</button></div>
            <p className={styles.note}>{t("공식 제출 서식이 아닌 편집용 초안입니다. 최종 공식 양식에 옮겨 확인하세요.", "This editable draft is not the official application form. Transfer and check it against the final official template.")}</p>
          </section>
          <aside className={styles.paper} aria-label={t("문서 미리보기", "Document preview")}>
            <h2>{gksWriterTitle(form)}</h2><p>{writer.fullName || "Applicant name"}</p>
            {writerFields[form].map(field => <div key={field.id}><h3>{draft.writerLanguage === "ko" ? field.ko : field.en}</h3><p>{writer[field.id] || "________________"}</p></div>)}
            <p className={styles.signature}>Date: ____________<br />Name: {writer.fullName || "____________"}<br />Signature: ____________</p>
          </aside>
        </div>
      </section>}
    </div>
  </div>;
}
