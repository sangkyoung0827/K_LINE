"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useHanhwalAccess } from "@/hooks/useHanhwalAccess";
import { isReadOnlyDeveloperEmail } from "@/lib/readOnlyDeveloper";

const defaults = {
  titleKo: "함께 배우고 수련하는 한국 활쏘기",
  titleEn: "Practice Korean archery together",
  bodyEn: "Hanhwal is a community that trains body and mind through Gungdo, traditional Korean archery. Beginners learn posture and shooting form step by step. Through regular practice, university competitions, member exchanges, group equipment orders, and uniform orders, we continue Korean archery culture together.",
  bodyKo: "한활은 한국의 전통 활쏘기인 국궁을 통해 몸과 마음을 수련하는 모임입니다. 처음 활을 잡는 사람도 기본 자세와 사법부터 차근차근 배우며, 함께 활을 쏘고 연습하는 과정에서 집중과 절제, 서로에 대한 배려를 익혀갑니다. 정기 활쏘기 연습을 중심으로 대학생 활쏘기 대회와 회원 교류 활동, 개인 활·화살 및 단체복 공동주문 등을 함께 운영합니다. 한활은 국궁을 단순히 체험하는 데 그치지 않고 직접 배우고 반복해 수련하며 한국 활쏘기의 문화를 함께 이어가는 공동체를 지향합니다."
};

export function HanhwalIntroduction() {
  const { language } = useLanguage();
  const access = useHanhwalAccess();
  const canEdit = access.isAdmin && !isReadOnlyDeveloperEmail(access.email);
  const [content, setContent] = useState(defaults);
  const [draft, setDraft] = useState(defaults);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleKey = language === "ko" ? "titleKo" : "titleEn";
  const bodyKey = language === "ko" ? "bodyKo" : "bodyEn";
  useEffect(() => {
    let active = true;
    fetch("/api/hanhwal/introduction", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Introduction could not be loaded.");
      return response.json();
    }).then((data) => {
      if (active && data.content) setContent({ ...defaults, ...data.content });
    }).catch(() => { if (active) setError(language === "ko" ? "소개문을 불러오지 못했습니다." : "Introduction could not be loaded."); });
    return () => { active = false; };
  }, [language]);
  function startEditing() {
    if (!canEdit) return;
    setDraft(content);
    setEditing(true);
    setError("");
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/hanhwal/introduction", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setContent(data.content);
      setEditing(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Save failed."); }
    finally { setSaving(false); }
  }
  return (
    <section className="mt-6 border-y border-navy/10 py-6 sm:mt-10 sm:py-8">
      <p className="text-xs font-bold uppercase text-brass">About Hanhwal</p>
      {editing ? <div className="mt-4 grid gap-3">
        <input aria-label={language === "ko" ? "소개 제목" : "Introduction title"} value={draft[titleKey]} onChange={(event) => setDraft({ ...draft, [titleKey]: event.target.value })} className="w-full border border-navy/20 bg-white p-3" />
        <textarea aria-label={language === "ko" ? "소개 내용" : "Introduction body"} value={draft[bodyKey]} onChange={(event) => setDraft({ ...draft, [bodyKey]: event.target.value })} className="min-h-48 w-full border border-navy/20 bg-white p-3" />
        <div className="flex gap-3"><button disabled={saving} onClick={save} className="bg-navy px-4 py-3 text-white">{language === "ko" ? "변경내용 저장하기" : "Save changes"}</button><button disabled={saving} onClick={() => setEditing(false)}>{language === "ko" ? "취소" : "Cancel"}</button></div>
      </div> : <div role={canEdit ? "button" : undefined} tabIndex={canEdit ? 0 : undefined} onClick={startEditing} onKeyDown={(event) => { if (canEdit && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); startEditing(); } }} aria-label={canEdit ? (language === "ko" ? "한활 소개 편집" : "Edit Hanhwal introduction") : undefined} className={canEdit ? "cursor-pointer" : undefined}>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-navy sm:text-3xl">{content[titleKey]}</h2>
        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-ink/75 sm:text-base sm:leading-8">{content[bodyKey]}</p>
      </div>}
      {error && canEdit ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
