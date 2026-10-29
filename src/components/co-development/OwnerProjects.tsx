"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { labApiPath, type LabOwnerProject, type LabOwnerDetail } from "@/lib/coDevelopment/model";
import { ScopedPreview } from "./ScopedPreview";

const button="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-ink/20 px-3 text-sm font-semibold disabled:opacity-40";
async function command<T>(body:Record<string,unknown>) {
  const response=await fetch(labApiPath,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error);return result as T;
}
export function OwnerProjects() {
  const {language}=useLanguage(),ko=language==="ko";
  const [items,setItems]=useState<LabOwnerProject[]>([]),[cursor,setCursor]=useState<string|null>(null),[detail,setDetail]=useState<LabOwnerDetail|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(false);
  const refresh=useCallback(async()=>{
    setBusy(true);setError(false);
    try {const page=await command<{projects:LabOwnerProject[];nextCursor:string|null}>({action:"owner_projects"});setItems(page.projects);setCursor(page.nextCursor);setDetail(null);}catch{setError(true);}finally{setBusy(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  async function inspect(id:string,revisionId?:string) {
    setBusy(true);setError(false);
    try {setDetail(await command<LabOwnerDetail>({action:"owner_project",id,...(revisionId?{revisionId}:{})}));}catch{setError(true);}finally{setBusy(false);}
  }
  async function more() {
    setBusy(true);setError(false);
    try {
      const page=await command<{projects:LabOwnerProject[];nextCursor:string|null}>({action:"owner_projects",after:cursor});
      setItems(current=>[...current,...page.projects.filter(p=>!current.some(v=>v.id===p.id))]);setCursor(page.nextCursor);
    }catch{setError(true);}finally{setBusy(false);}
  }
  return <section className="space-y-4 border-t border-ink/20 pt-5" aria-label={ko?"소유자 전체 작업 목록":"Owner project oversight"}>
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{ko?"모든 개발 결과물":"All development work"}</h2><button className={button} disabled={busy} onClick={()=>void refresh()}><RefreshCw size={16}/>{ko?"목록 새로고침":"Refresh projects"}</button></header>
    {error&&<p role="alert" className="text-sm text-red-800">{ko?"작업 목록을 불러오지 못했습니다.":"Could not load development work."}</p>}
    {!items.length&&!busy&&!error&&<p className="text-sm text-muted">{ko?"저장된 결과물이 없습니다.":"No saved projects."}</p>}
    <ul className="divide-y divide-ink/15">{items.map(project=><li key={project.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0 flex-1 break-words"><h3 className="font-semibold">{project.title}</h3><p className="mt-1 break-all text-xs text-muted">{project.created_by} · v{project.revision} · {project.review_state==="review_requested"?(ko?"검수 요청":"Review requested"):(ko?"개발 중":"Draft")}</p></div><button className={button} disabled={busy} onClick={()=>void inspect(project.id)}><Eye size={16}/>{ko?"결과 확인":"Inspect"}</button></li>)}</ul>
    {cursor&&<button className={button} disabled={busy} onClick={()=>void more()}>{ko?"더 보기":"Load more"}</button>}
    {detail&&<div className="space-y-4 border-y border-ink/20 py-5"><header className="flex flex-wrap items-center justify-between gap-3"><h3 className="break-words text-lg font-semibold">{detail.revision.title}</h3><select aria-label={ko?"검토할 저장 버전":"Saved version to inspect"} className="form-field max-w-48" disabled={busy} value={detail.revision.id} onChange={event=>void inspect(detail.project.id,event.target.value)}>{detail.revisions.map(r=><option key={r.id} value={r.id}>v{r.revision}</option>)}</select></header>
      <ScopedPreview key={detail.revision.id} id={detail.revision.id} ownerDraft/>
      <details><summary className="cursor-pointer py-2 text-sm font-semibold">{ko?"코드와 원본":"Code and source"}</summary><textarea readOnly aria-label={ko?"저장된 HTML":"Saved HTML"} className="form-field h-64 font-mono text-xs" value={detail.revision.html}/>{detail.source&&<pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words border border-ink/15 p-3 text-xs">{JSON.stringify(detail.source,null,2)}</pre>}</details>
    </div>}
  </section>;
}
