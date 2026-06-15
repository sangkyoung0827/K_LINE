"use client";

import { Edit3, ImagePlus, Save, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

type ProjectContribution = {
  id: string;
  projectId: string;
  author: string;
  title: string;
  content: string;
  detailContent: string;
  imageBlob?: Blob;
  imageDataUrl?: string;
  imageName?: string;
  createdAt: string;
  updatedAt?: string;
};

const initialForm = {
  author: "",
  title: "",
  content: "",
  detailContent: "",
  imageBlob: undefined as Blob | undefined,
  imageDataUrl: "",
  imageName: ""
};

const dbName = "k_line_project_contributions";
const storeName = "contributions";

function legacyStorageKey(projectId: string) {
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

function openProjectDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath: "id" });
        store.createIndex("projectId", "projectId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getProjectContributions(projectId: string) {
  const db = await openProjectDb();

  return new Promise<ProjectContribution[]>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const index = store.index("projectId");
    const request = index.getAll(projectId);

    request.onsuccess = () => resolve(request.result as ProjectContribution[]);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function saveProjectContribution(contribution: ProjectContribution) {
  const db = await openProjectDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(contribution);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function migrateLegacyContributions(projectId: string) {
  try {
    const raw = window.localStorage.getItem(legacyStorageKey(projectId));
    if (!raw) {
      return;
    }

    const legacy = JSON.parse(raw) as Omit<ProjectContribution, "projectId" | "detailContent">[];
    await Promise.all(
      legacy.map((item) =>
        saveProjectContribution({
          ...item,
          projectId,
          detailContent: item.content
        })
      )
    );
    window.localStorage.removeItem(legacyStorageKey(projectId));
  } catch {
    // Legacy migration is best-effort only.
  }
}

function getImageSource(contribution: ProjectContribution) {
  if (contribution.imageBlob) {
    return URL.createObjectURL(contribution.imageBlob);
  }

  return contribution.imageDataUrl ?? "";
}

export function ProjectContributionBoard({ projectId }: { projectId: string }) {
  const { language } = useLanguage();
  const [form, setForm] = useState(initialForm);
  const [contributions, setContributions] = useState<ProjectContribution[]>([]);
  const [imageError, setImageError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [selectedContribution, setSelectedContribution] = useState<ProjectContribution | null>(null);
  const [editingId, setEditingId] = useState("");
  const isEditing = Boolean(editingId);
  const sortedContributions = useMemo(
    () =>
      [...contributions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [contributions]
  );

  const refresh = async () => {
    try {
      await migrateLegacyContributions(projectId);
      setContributions(await getProjectContributions(projectId));
      setStorageError("");
    } catch {
      setStorageError(
        language === "ko"
          ? "프로젝트 게시글 저장소를 불러오지 못했습니다."
          : "Project post storage could not be loaded."
      );
    }
  };

  useEffect(() => {
    void refresh();
  }, [projectId]);

  const update = (field: keyof typeof initialForm, value: string | Blob | undefined) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImageError("");

    if (!file) {
      update("imageBlob", undefined);
      update("imageDataUrl", "");
      update("imageName", "");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setImageError(
        language === "ko" ? "이미지 파일만 업로드할 수 있습니다." : "Only image files can be uploaded."
      );
      event.target.value = "";
      return;
    }

    update("imageBlob", file);
    update("imageDataUrl", "");
    update("imageName", file.name);
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId("");
    setImageError("");
  };

  const startEdit = (contribution: ProjectContribution) => {
    setEditingId(contribution.id);
    setForm({
      author: contribution.author,
      title: contribution.title,
      content: contribution.content,
      detailContent: contribution.detailContent || contribution.content,
      imageBlob: contribution.imageBlob,
      imageDataUrl: contribution.imageDataUrl ?? "",
      imageName: contribution.imageName ?? ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const previous = contributions.find((item) => item.id === editingId);
    const now = new Date().toISOString();
    const nextContribution: ProjectContribution = {
      id: previous?.id ?? `project-contribution-${Date.now()}`,
      projectId,
      author: form.author.trim(),
      title: form.title.trim(),
      content: form.content.trim(),
      detailContent: form.detailContent.trim() || form.content.trim(),
      imageBlob: form.imageBlob ?? previous?.imageBlob,
      imageDataUrl: form.imageDataUrl || previous?.imageDataUrl,
      imageName: form.imageName || previous?.imageName,
      createdAt: previous?.createdAt ?? now,
      updatedAt: previous ? now : undefined
    };

    try {
      await saveProjectContribution(nextContribution);
      await refresh();
      setSelectedContribution((current) =>
        current?.id === nextContribution.id ? nextContribution : current
      );
      resetForm();
      setStorageError("");
    } catch {
      setStorageError(
        language === "ko"
          ? "게시글 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요."
          : "The post could not be saved. Please check browser storage space."
      );
    }
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
            en="Upload a project photo, a short card description, and a detailed development note. Posts appear as half-width cards in newest-first order."
            ko="프로젝트 사진, 카드 설명, 상세 개발 과정을 올릴 수 있습니다. 게시글은 최신순으로 절반 너비 카드 형태로 표시됩니다."
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
          className="form-field min-h-28"
          placeholder={language === "ko" ? "카드에 보일 짧은 설명" : "Short card description"}
          value={form.content}
          onChange={(event) => update("content", event.target.value)}
        />
        <textarea
          className="form-field min-h-44"
          placeholder={
            language === "ko"
              ? "상세 내용: 실제 제작 과정, 현재까지의 개발 과정, 다음 단계 등"
              : "Detail: making process, current development progress, next steps, and notes"
          }
          value={form.detailContent}
          onChange={(event) => update("detailContent", event.target.value)}
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
        {storageError ? <p className="text-sm font-semibold text-red-700">{storageError}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
          >
            {isEditing ? <Save aria-hidden className="h-4 w-4" /> : <Send aria-hidden className="h-4 w-4" />}
            {isEditing ? <I18nText en="Save changes" ko="수정 저장" /> : <I18nText en="Upload" ko="업로드" />}
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-11 w-fit items-center justify-center gap-2 border border-ink/12 px-5 text-sm font-semibold text-ink transition hover:border-brass"
            >
              <X aria-hidden className="h-4 w-4" />
              <I18nText en="Cancel edit" ko="수정 취소" />
            </button>
          ) : null}
        </div>
      </form>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {sortedContributions.map((contribution) => (
          <ProjectContributionCard
            key={contribution.id}
            contribution={contribution}
            language={language}
            onEdit={() => startEdit(contribution)}
            onOpen={() => setSelectedContribution(contribution)}
          />
        ))}
      </div>

      {selectedContribution ? (
        <ProjectContributionModal
          contribution={selectedContribution}
          language={language}
          onClose={() => setSelectedContribution(null)}
          onEdit={() => {
            startEdit(selectedContribution);
            setSelectedContribution(null);
          }}
        />
      ) : null}
    </section>
  );
}

function ProjectContributionCard({
  contribution,
  language,
  onEdit,
  onOpen
}: {
  contribution: ProjectContribution;
  language: "en" | "ko";
  onEdit: () => void;
  onOpen: () => void;
}) {
  const imageSource = getImageSource(contribution);

  return (
    <article className="overflow-hidden border border-ink/10 bg-white/60 transition hover:-translate-y-1 hover:border-brass/45 hover:shadow-soft">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {imageSource ? (
          <img
            src={imageSource}
            alt={`${contribution.title} uploaded project photo`}
            loading="lazy"
            decoding="async"
            className="h-64 w-full object-cover"
            onLoad={() => {
              if (contribution.imageBlob) {
                URL.revokeObjectURL(imageSource);
              }
            }}
          />
        ) : (
          <div className="grid h-64 place-items-center bg-hanji text-sm font-semibold text-ink/48">
            <I18nText en="No image yet" ko="사진 없음" />
          </div>
        )}
        <div className="grid gap-3 p-5">
          <p className="text-xs font-semibold uppercase text-brass">
            {contribution.author} / {formatDate(contribution.createdAt, language)}
          </p>
          <h3 className="font-serif text-2xl font-semibold text-ink">{contribution.title}</h3>
          <p className="whitespace-pre-wrap text-sm leading-7 text-ink/68">{contribution.content}</p>
        </div>
      </button>
      <div className="border-t border-ink/10 p-4">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-10 items-center justify-center gap-2 border border-ink/12 px-4 text-xs font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
        >
          <Edit3 aria-hidden className="h-3.5 w-3.5" />
          <I18nText en="Edit post" ko="게시글 수정" />
        </button>
      </div>
    </article>
  );
}

function ProjectContributionModal({
  contribution,
  language,
  onClose,
  onEdit
}: {
  contribution: ProjectContribution;
  language: "en" | "ko";
  onClose: () => void;
  onEdit: () => void;
}) {
  const imageSource = getImageSource(contribution);

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-ink/70 px-4 py-8 backdrop-blur-sm">
      <article className="mx-auto max-w-5xl overflow-hidden bg-paper shadow-soft">
        {imageSource ? (
          <img
            src={imageSource}
            alt={`${contribution.title} project detail photo`}
            className="max-h-[62vh] w-full object-cover"
            onLoad={() => {
              if (contribution.imageBlob) {
                URL.revokeObjectURL(imageSource);
              }
            }}
          />
        ) : null}
        <div className="grid gap-5 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-brass">
                {contribution.author} / {formatDate(contribution.createdAt, language)}
              </p>
              <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">
                {contribution.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center border border-ink/12 text-ink transition hover:border-brass"
              aria-label={language === "ko" ? "닫기" : "Close"}
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
          <p className="whitespace-pre-wrap text-base leading-8 text-ink/72">
            {contribution.detailContent || contribution.content}
          </p>
          {contribution.updatedAt ? (
            <p className="text-xs font-semibold uppercase text-ink/42">
              <I18nText en="Updated" ko="수정됨" /> / {formatDate(contribution.updatedAt, language)}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
          >
            <Edit3 aria-hidden className="h-4 w-4" />
            <I18nText en="Edit this post" ko="이 게시글 수정" />
          </button>
        </div>
      </article>
    </div>
  );
}
