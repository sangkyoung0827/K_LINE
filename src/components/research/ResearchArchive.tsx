"use client";

import Link from "next/link";
import { BookOpen, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { filterResearchItems, researchCategories, type ResearchItem } from "@/lib/research/model";

const base = "/open-k-culture-research";

function mediaUrl(item: ResearchItem) {
  return item.coverPath ? `/api/research/media/${item.id}/${item.coverPath.split("/").pop()}` : "/images/hanhwal-site/arrows.webp";
}

export function ResearchArchive({ initialItems, canEdit, initialOrganization = "", initialTag = "" }: { initialItems: ResearchItem[]; canEdit: boolean; initialOrganization?: string; initialTag?: string }) {
  const { language } = useLanguage();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [organization, setOrganization] = useState(
    initialItems.find((item) => item.authorOrganization.toLowerCase() === initialOrganization.toLowerCase())?.authorOrganization || initialOrganization
  );
  const [tag, setTag] = useState(initialTag);
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const organizations = useMemo(() => [...new Set(items.map((item) => item.authorOrganization).filter(Boolean))].sort(), [items]);
  const categories = useMemo(() => [...new Set([...researchCategories, ...items.map((item) => item.category)])], [items]);
  const shown = useMemo(() => filterResearchItems(items, { query, category, organization, tag }), [items, query, category, organization, tag]);

  const toggleManage = async () => {
    setBusy(true);
    setError("");
    try {
      const next = !manage;
      const response = await fetch(`/api/research${next ? "?manage=1" : ""}`, { cache: "no-store" });
      const data = await response.json() as { items?: ResearchItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Archive could not be loaded.");
      setItems(data.items || []);
      setManage(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Archive could not be loaded."); }
    finally { setBusy(false); }
  };

  const create = async () => {
    const title = window.prompt(language === "ko" ? "새 연구자료의 제목" : "Title for the new research item");
    if (!title?.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(language === "ko" ? { titleKo: title } : { titleEn: title })
      });
      const data = await response.json() as { item?: ResearchItem; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "Research draft could not be created.");
      window.location.href = `${base}/${data.item.id}?edit=1`;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Research draft could not be created."); setBusy(false); }
  };

  return (
    <section className="bg-paper px-4 py-8 sm:px-6 sm:py-12 md:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-navy/15 pb-7">
          <div>
            <p className="text-xs font-bold uppercase text-brass">K_LINE RESEARCH ARCHIVE</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-navy sm:text-4xl">Open K-Culture Research</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted sm:text-base">
              {language === "ko" ? "한국문화의 전통, 철학, 생활문화와 실제 체험을 연구하고 기록하는 공개 아카이브" : "Exploring Korean Culture, Tradition & Experience"}
            </p>
          </div>
          {canEdit ? <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={toggleManage} className="min-h-10 border border-navy/20 px-4 text-sm font-semibold text-navy">
              {manage ? (language === "ko" ? "공개 보기" : "Public view") : (language === "ko" ? "관리 보기" : "Manage")}
            </button>
            <button type="button" disabled={busy} onClick={create} className="inline-flex min-h-10 items-center gap-2 bg-navy px-4 text-sm font-semibold text-white">
              <Plus aria-hidden className="h-4 w-4" />{language === "ko" ? "자료 만들기" : "Create research"}
            </button>
          </div> : null}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <label className="relative block">
            <span className="sr-only">{language === "ko" ? "제목 또는 태그 검색" : "Search titles or tags"}</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/50" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={language === "ko" ? "제목 또는 태그 검색" : "Search titles or tags"} className="form-field !min-h-11 !rounded-md !pl-10" />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category" className="form-field !min-h-11 !rounded-md">
            <option value="">{language === "ko" ? "전체 유형" : "All categories"}</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={organization} onChange={(event) => setOrganization(event.target.value)} aria-label="Organization" className="form-field !min-h-11 !rounded-md">
            <option value="">{language === "ko" ? "전체 단체" : "All organizations"}</option>
            {organization && !organizations.includes(organization) ? <option value={organization}>{organization}</option> : null}
            {organizations.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <input value={tag} onChange={(event) => setTag(event.target.value)} aria-label="Tag" placeholder={language === "ko" ? "태그" : "Tag"} className="form-field !min-h-11 !rounded-md" />
        </div>
        {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
        <div className="mt-8 flex items-center justify-between text-sm text-muted">
          <span>{shown.length} {language === "ko" ? "건" : "items"}</span>
          <span>{language === "ko" ? "최신순" : "Newest first"}</span>
        </div>
        {shown.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((item) => <Link href={`${base}/${item.id}`} key={item.id} className="group overflow-hidden rounded-lg border border-navy/10 bg-white transition hover:border-brass/60 hover:shadow-md">
            <div className="aspect-[16/10] overflow-hidden bg-hanji">
              <img src={mediaUrl(item)} alt={item.titleEn || item.titleKo} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                <span>{item.category}</span><span aria-hidden>·</span><span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString(language === "ko" ? "ko-KR" : "en-US") : (language === "ko" ? "미발행" : "Unpublished")}</span>
                <span className="border border-navy/15 px-1.5 py-0.5">{manage && item.isSample ? "SAMPLE · " : ""}{manage ? `${item.status} / ` : ""}{item.visibility}</span>
              </div>
              <h2 className="mt-3 font-serif text-xl font-semibold text-navy">{language === "ko" ? item.titleKo || item.titleEn : item.titleEn || item.titleKo}</h2>
              {item.titleKo && item.titleEn ? <p className="mt-1 text-sm text-muted">{language === "ko" ? item.titleEn : item.titleKo}</p> : null}
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{language === "ko" ? item.summaryKo || item.summaryEn : item.summaryEn || item.summaryKo}</p>
              <p className="mt-4 text-xs font-semibold text-navy">{item.authorOrganization || item.authorName}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{item.tags.slice(0, 3).map((value) => <span key={value} className="bg-hanji px-2 py-1 text-xs text-navy">{value}</span>)}</div>
            </div>
          </Link>)}
        </div> : <div className="mt-8 border-t border-navy/10 py-16 text-center text-muted">
          <BookOpen aria-hidden className="mx-auto h-8 w-8" />
          <p className="mt-3 text-sm">{language === "ko" ? "표시할 연구자료가 없습니다." : "No research items to display."}</p>
        </div>}
      </div>
    </section>
  );
}
