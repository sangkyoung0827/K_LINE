"use client";

import { ImagePlus, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

type ProjectContribution = {
  id: string;
  author: string;
  title: string;
  content: string;
  imageDataUrl?: string;
  imageName?: string;
  createdAt: string;
};

const initialForm = {
  author: "",
  title: "",
  content: "",
  imageDataUrl: "",
  imageName: ""
};

function storageKey(projectId: string) {
  return `k_line_project_contributions_${projectId}`;
}

function formatDate(value: string, language: "en" | "ko") {
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function readContributions(projectId: string) {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    return raw ? (JSON.parse(raw) as ProjectContribution[]) : [];
  } catch {
    return [];
  }
}

export function ProjectContributionBoard({ projectId }: { projectId: string }) {
  const { language } = useLanguage();
  const [form, setForm] = useState(initialForm);
  const [contributions, setContributions] = useState<ProjectContribution[]>([]);
  const [imageError, setImageError] = useState("");
  const sortedContributions = useMemo(
    () =>
      [...contributions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [contributions]
  );

  useEffect(() => {
    setContributions(readContributions(projectId));
  }, [projectId]);

  const update = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImageError("");

    if (!file) {
      update("imageDataUrl", "");
      update("imageName", "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setImageError(language === "ko" ? "이미지 파일만 업로드할 수 있습니다." : "Only image files can be uploaded.");
      event.target.value = "";
      return;
    }

    if (file.size > 1_800_000) {
      setImageError(language === "ko" ? "사진은 1.8MB 이하 파일을 선택해 주세요." : "Please choose a photo under 1.8MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      update("imageDataUrl", String(reader.result));
      update("imageName", file.name);
    };
    reader.readAsDataURL(file);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextContribution: ProjectContribution = {
      id: `project-contribution-${Date.now()}`,
      author: form.author.trim(),
      title: form.title.trim(),
      content: form.content.trim(),
      imageDataUrl: form.imageDataUrl || undefined,
      imageName: form.imageName || undefined,
      createdAt: new Date().toISOString()
    };
    const nextContributions = [nextContribution, ...contributions];
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(nextContributions));
    setContributions(nextContributions);
    setForm(initialForm);
    setImageError("");
  };

  return (
    <section className="paper-panel p-6 md:p-8">
      <div>
        <p className="text-sm font-semibold uppercase text-brass">
          <I18nText en="Project upload" ko="프로젝트 업로드" />
        </p>
        <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">
          <I18nText en="Add London project notes and photos" ko="London 프로젝트 내용과 사진 업로드" />
        </h2>
        <p className="mt-4 text-sm leading-7 text-ink/64">
          <I18nText
            en="Anyone can add project-related text and photos here. Posts are shown as cards in newest-first order."
            ko="누구나 프로젝트 관련 내용과 사진을 올릴 수 있습니다. 올라온 내용은 최신순 카드로 표시됩니다."
          />
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <input
            required
            className="form-field"
            placeholder={language === "ko" ? "이름" : "Name"}
            value={form.author}
            onChange={(event) => update("author", event.target.value)}
          />
          <input
            required
            className="form-field"
            placeholder={language === "ko" ? "제목" : "Title"}
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
          />
        </div>
        <textarea
          required
          className="form-field min-h-36"
          placeholder={language === "ko" ? "프로젝트 내용" : "Project content"}
          value={form.content}
          onChange={(event) => update("content", event.target.value)}
        />
        <label className="grid cursor-pointer gap-3 border border-dashed border-ink/18 bg-white/35 p-4 transition hover:border-brass hover:bg-brass/10">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <ImagePlus aria-hidden className="h-4 w-4" />
            <I18nText en="Project photo" ko="프로젝트 사진" />
          </span>
          <input type="file" accept="image/*" onChange={selectImage} className="text-sm" />
          {form.imageName ? <span className="text-xs text-ink/58">{form.imageName}</span> : null}
          {imageError ? <span className="text-xs font-semibold text-red-700">{imageError}</span> : null}
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
        >
          <Send aria-hidden className="h-4 w-4" />
          <I18nText en="Upload" ko="업로드" />
        </button>
      </form>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {sortedContributions.map((contribution) => (
          <article key={contribution.id} className="overflow-hidden border border-ink/10 bg-white/60">
            {contribution.imageDataUrl ? (
              <img
                src={contribution.imageDataUrl}
                alt={`${contribution.title} uploaded project photo`}
                loading="lazy"
                decoding="async"
                className="h-56 w-full object-cover"
              />
            ) : null}
            <div className="grid gap-3 p-5">
              <p className="text-xs font-semibold uppercase text-brass">
                {contribution.author} / {formatDate(contribution.createdAt, language)}
              </p>
              <h3 className="font-serif text-2xl font-semibold text-ink">{contribution.title}</h3>
              <p className="whitespace-pre-wrap text-sm leading-7 text-ink/68">{contribution.content}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
