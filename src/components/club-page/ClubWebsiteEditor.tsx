"use client";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ChevronDown, Eye, Globe2, GripVertical, Plus, Save, Trash2, X } from "lucide-react";
import type { ClubDocument, ClubDraft, ClubKey, ClubSection, SectionType } from "@/types/club-page";
import { CLUB_PAGE_CONFIG, newSection, SECTION_LABELS, THEME_PRESETS } from "@/lib/club-page/config";
import { validateDocument } from "@/lib/club-page/validation";
import { SECTION_EDITORS } from "./editor-registry";
import type { EditorProps } from "./editors/Sections";
import { ClubWebsiteRenderer } from "./ClubWebsiteRenderer";
import styles from "./club-page.module.css";

function SectionItem({ section, clubKey, onChange, onRemove }: { section: ClubSection; clubKey: ClubKey; onChange: (section: ClubSection) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(true);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const Editor = SECTION_EDITORS[section.type] as ComponentType<EditorProps<SectionType>>;
  return <div ref={setNodeRef} className={styles.sectionItem} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
    <div className={styles.sectionHeader}>
      <button type="button" className={styles.drag} {...attributes} {...listeners} aria-label={`${SECTION_LABELS[section.type]} 순서 이동`} title="순서 이동"><GripVertical size={18} /></button>
      <button type="button" className={styles.expand} aria-expanded={open} onClick={() => setOpen(!open)}>{SECTION_LABELS[section.type]}<ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : undefined }} /></button>
      <button type="button" aria-label={`${SECTION_LABELS[section.type]} 삭제`} title="블록 삭제" onClick={onRemove}><Trash2 size={16} /></button>
    </div>
    {open && <div className={styles.sectionFields}><Editor clubKey={clubKey} data={section.data} onChange={data => onChange({ ...section, data } as ClubSection)} /></div>}
  </div>;
}
export function ClubWebsiteEditor({ clubKey }: { clubKey: ClubKey }) {
  const config = CLUB_PAGE_CONFIG[clubKey];
  const [document, setDocument] = useState<ClubDocument | null>(null);
  const [saved, setSaved] = useState("");
  const [revision, setRevision] = useState(0);
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [mobileView, setMobileView] = useState("edit");
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const dirty = document !== null && JSON.stringify(document) !== saved;
  const load = useCallback(async () => {
    setError(""); setBusy(true);
    try {
      const response = await fetch(`/api/club-pages/${clubKey}/draft`, { cache: "no-store" });
      const data = await response.json() as ClubDraft & { error?: string };
      if (!response.ok) throw new Error(data.error || "웹사이트 편집 데이터를 불러오지 못했습니다.");
      const next = validateDocument({ themeId: data.themeId, sections: data.sections }, clubKey);
      setDocument(next); setSaved(JSON.stringify(next)); setRevision(data.revision); setPublished(data.isPublished); setStatus("");
    } catch (err) { setError(err instanceof Error ? err.message : "웹사이트 편집 데이터를 불러오지 못했습니다."); }
    finally { setBusy(false); }
  }, [clubKey]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { if (confirm) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [confirm]);
  async function write(action: "draft" | "publish" | "unpublish") {
    if (!document || busy) return;
    setError(""); setStatus(""); setBusy(true);
    const snapshot = document;
    try {
      validateDocument(snapshot, clubKey);
      const response = await fetch(`/api/club-pages/${clubKey}/${action}`, { method: action === "draft" ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document: snapshot, revision }) });
      const result = await response.json();
      if (!response.ok || !Number.isSafeInteger(result.revision)) throw new Error(result.error || "저장에 실패했습니다. 기존 데이터는 변경되지 않았습니다.");
      setRevision(result.revision);
      if (action !== "unpublish") setSaved(JSON.stringify(snapshot));
      if (action !== "draft") setPublished(action === "publish");
      setStatus(action === "draft" ? "저장됨" : action === "publish" ? "웹사이트가 공개되었습니다." : "공개가 중지되었습니다.");
      setConfirm(null);
    } catch (err) { setError(err instanceof Error ? err.message : "저장에 실패했습니다. 기존 데이터는 변경되지 않았습니다."); setConfirm(null); }
    finally { setBusy(false); }
  }
  const updateSection = (next: ClubSection) => setDocument(old => old && ({ ...old, sections: old.sections.map(section => section.id === next.id ? next : section) }));
  return <div className={styles.builder}>
    <header className={styles.toolbar}>
      <Link href={config.officialPath} aria-label="OFFICIAL로 돌아가기" title="돌아가기" onClick={event => { if (dirty && !window.confirm("저장하지 않은 변경을 두고 나갈까요?")) event.preventDefault(); }}><ArrowLeft size={20} /></Link>
      <div><h1>{config.label} 웹사이트 만들기</h1><small>{published ? "공개 중" : "비공개"} · {dirty ? "저장되지 않은 변경" : "초안"}</small></div>
      <div className={styles.actions}>
        {published && <a href={config.publicPath} target="_blank" rel="noreferrer" title="공개 웹사이트 보기" aria-label="공개 웹사이트 보기"><Eye size={18} /></a>}
        <button disabled={!document || busy} onClick={() => void write("draft")}><Save size={16} />저장</button>
        <button className={styles.primary} disabled={!document || busy} onClick={() => setConfirm("publish")}><Globe2 size={16} />웹사이트 공개</button>
      </div>
    </header>
    <div className={styles.feedback} aria-live="polite">{busy ? "처리 중…" : dirty && status === "저장됨" ? "" : status}{error && <p role="alert">{error}</p>}
      {error && <button onClick={() => { if (!dirty || window.confirm("저장되지 않은 변경을 버리고 다시 불러올까요?")) void load(); }}>다시 불러오기</button>}
    </div>
    <div className={styles.mobileTabs} role="tablist" aria-label="작업 화면">{["edit", "preview"].map(view => <button role="tab" aria-selected={mobileView === view} key={view} onClick={() => setMobileView(view)}>{view === "edit" ? "편집" : "미리보기"}</button>)}</div>
    {document && <div className={styles.workspace}>
      <aside className={`${styles.editorPane} ${mobileView !== "edit" ? styles.mobileHidden : ""}`}>
        <fieldset className={styles.themes}><legend>테마</legend>{THEME_PRESETS.map(theme => <label key={theme.id} title={theme.name}><input type="radio" name="club-theme" value={theme.id} checked={document.themeId === theme.id} onChange={() => setDocument({ ...document, themeId: theme.id })} /><span className={styles.swatch} style={{ backgroundColor: theme.primary }} /><span>{theme.name}</span></label>)}</fieldset>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id) return;
          setDocument(old => old && ({ ...old, sections: arrayMove(old.sections, old.sections.findIndex(section => section.id === active.id), old.sections.findIndex(section => section.id === over.id)) }));
        }}>
          <SortableContext items={document.sections.map(section => section.id)} strategy={verticalListSortingStrategy}>
            {document.sections.map(section => <SectionItem key={section.id} section={section} clubKey={clubKey} onChange={updateSection} onRemove={() => { if (window.confirm("이 블록을 초안에서 삭제할까요?")) setDocument(old => old && ({ ...old, sections: old.sections.filter(item => item.id !== section.id) })); }} />)}
          </SortableContext>
        </DndContext>
        <button className={styles.add} disabled={document.sections.length >= 30} aria-expanded={addOpen} onClick={() => setAddOpen(!addOpen)}><Plus size={18} />블록 추가</button>
        {addOpen && <div className={styles.addMenu}>{(Object.keys(SECTION_LABELS) as SectionType[]).map(type => <button key={type} onClick={() => { setDocument({ ...document, sections: [...document.sections, newSection(type, clubKey)] }); setAddOpen(false); }}>{SECTION_LABELS[type]}</button>)}</div>}
        {published && <button className={styles.unpublish} disabled={busy} onClick={() => setConfirm("unpublish")}>공개 중지</button>}
      </aside>
      <section className={`${styles.previewPane} ${mobileView !== "preview" ? styles.mobileHidden : ""}`} aria-label="실시간 웹사이트 미리보기">
        <div className={styles.previewLabel}><Eye size={16} />미리보기</div>
        {document.sections.length ? <div className={styles.previewContent} onClickCapture={event => { if ((event.target as HTMLElement).closest("a")) event.preventDefault(); }}><ClubWebsiteRenderer document={document} /></div> : <div className={styles.empty}><Globe2 size={32} /><h2>{config.label}</h2></div>}
      </section>
    </div>}
    <dialog ref={dialogRef} className={styles.dialog} onCancel={() => setConfirm(null)} onClose={() => setConfirm(null)}>
      <button className={styles.dialogClose} title="닫기" aria-label="닫기" onClick={() => setConfirm(null)}><X size={20} /></button>
      <h2>{confirm === "unpublish" ? "웹사이트 공개 중지" : "웹사이트 공개"}</h2>
      <p>{confirm === "unpublish" ? `${config.label} 웹사이트 공개를 중지할까요?` : `${config.label} 웹사이트를 현재 미리보기 상태로 공개할까요?`}</p>
      <div className={styles.actions}><button disabled={busy} onClick={() => setConfirm(null)}>취소</button><button className={styles.primary} disabled={busy} onClick={() => confirm && void write(confirm)}>{confirm === "unpublish" ? "공개 중지" : "공개"}</button></div>
    </dialog>
  </div>;
}
