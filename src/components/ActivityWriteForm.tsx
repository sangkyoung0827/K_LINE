"use client";

import { useState } from "react";
import { CTAButton } from "@/components/CTAButton";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

const categories = ["News", "Activity Log", "Review", "Field Note", "Free Board"];
const categoryLabels: Record<string, { en: string; ko: string }> = {
  News: { en: "News", ko: "소식" },
  "Activity Log": { en: "Activity Log", ko: "활동 기록" },
  Review: { en: "Review", ko: "후기" },
  "Field Note": { en: "Field Note", ko: "현장 노트" },
  "Free Board": { en: "Free Board", ko: "자유 글" }
};

const initialState = {
  title: "",
  category: categories[0],
  authorName: "",
  email: "",
  content: "",
  imageUrl: "",
  tags: ""
};

export function ActivityWriteForm() {
  const [form, setForm] = useState(initialState);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { language } = useLanguage();

  const update = (field: keyof typeof initialState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSuccess(false);
    setError("");

    try {
      const response = await fetch("/api/activity-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Activity post could not be saved.");
      }

      setForm(initialState);
      setSuccess(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Activity post could not be saved."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-4 p-5 md:p-8">
      <div>
        <h2 className="font-serif text-3xl font-semibold text-ink">
          <I18nText en="Write an Activity Post" ko="활동 글쓰기" />
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink/68">
          <I18nText
            en="Submitted posts are saved for pending review. Public posting stays separate from this submission flow until moderation is complete."
            ko="제출한 글은 검토 대기 상태로 저장됩니다. 공개 게시와 이 제출 흐름은 검토가 완료될 때까지 분리됩니다."
          />
        </p>
      </div>
      <input required className="form-field" placeholder={language === "ko" ? "제목" : "Title"} value={form.title} onChange={(event) => update("title", event.target.value)} />
      <div className="grid gap-4 md:grid-cols-2">
        <select className="form-field" value={form.category} onChange={(event) => update("category", event.target.value)}>
          {categories.map((category) => (
            <option key={category} value={category}>
              {categoryLabels[category][language]}
            </option>
          ))}
        </select>
        <input required className="form-field" placeholder={language === "ko" ? "작성자 이름" : "Author name"} value={form.authorName} onChange={(event) => update("authorName", event.target.value)} />
        <input required type="email" className="form-field" placeholder="Email" value={form.email} onChange={(event) => update("email", event.target.value)} />
        <input className="form-field" placeholder={language === "ko" ? "이미지 URL 또는 이미지 업로드 자리표시자" : "Image URL or image upload placeholder"} value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} />
      </div>
      <textarea required className="form-field min-h-56" placeholder={language === "ko" ? "내용" : "Content"} value={form.content} onChange={(event) => update("content", event.target.value)} />
      <input className="form-field" placeholder={language === "ko" ? "태그, 쉼표로 구분" : "Tags, separated by commas"} value={form.tags} onChange={(event) => update("tags", event.target.value)} />
      <div>
        <CTAButton type="submit" disabled={submitting}>
          {submitting
            ? language === "ko"
              ? "제출 중..."
              : "Submitting..."
            : language === "ko"
              ? "검토 대기 글 제출"
              : "Submit Pending Post"}
        </CTAButton>
      </div>
      {success ? (
        <p className="text-sm font-semibold text-pine">
          <I18nText
            en="Activity post saved to Supabase and marked pending review."
            ko="활동 글이 Supabase에 저장되었고 검토 대기 상태로 표시되었습니다."
          />
        </p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </form>
  );
}
