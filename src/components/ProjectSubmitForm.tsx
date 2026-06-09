"use client";

import { useState } from "react";
import { CTAButton } from "@/components/CTAButton";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

const initialState = {
  projectTitle: "",
  englishTitle: "",
  teamOrAuthor: "",
  category: "",
  countryOrCity: "",
  shortDescription: "",
  fullDescription: "",
  contactEmail: "",
  imageUrl: "",
  tags: "",
  message: ""
};

export function ProjectSubmitForm() {
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
      const response = await fetch("/api/project-submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Project submission could not be saved.");
      }

      setForm(initialState);
      setSuccess(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Project submission could not be saved."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-4 p-5 md:p-8">
      <div>
        <h2 className="font-serif text-3xl font-semibold text-ink">
          <I18nText en="Submit a K-Culture Project" ko="K-컬처 프로젝트 제출" />
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink/68">
          <I18nText
            en="Submissions are saved for pending review. Public posting, moderation, image upload, and publishing approval are handled separately."
            ko="제출 내용은 검토 대기 상태로 저장됩니다. 공개 게시, 검토, 이미지 업로드, 게시 승인은 별도로 처리됩니다."
          />
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <input required className="form-field" placeholder={language === "ko" ? "프로젝트 제목" : "Project title"} value={form.projectTitle} onChange={(event) => update("projectTitle", event.target.value)} />
        <input className="form-field" placeholder={language === "ko" ? "영문 제목" : "English title"} value={form.englishTitle} onChange={(event) => update("englishTitle", event.target.value)} />
        <input required className="form-field" placeholder={language === "ko" ? "팀 또는 작성자 이름" : "Team or author name"} value={form.teamOrAuthor} onChange={(event) => update("teamOrAuthor", event.target.value)} />
        <input className="form-field" placeholder={language === "ko" ? "카테고리" : "Category"} value={form.category} onChange={(event) => update("category", event.target.value)} />
        <input className="form-field" placeholder={language === "ko" ? "국가 또는 도시" : "Country or city"} value={form.countryOrCity} onChange={(event) => update("countryOrCity", event.target.value)} />
        <input required type="email" className="form-field" placeholder={language === "ko" ? "연락 이메일" : "Contact email"} value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} />
      </div>
      <textarea required className="form-field min-h-24" placeholder={language === "ko" ? "짧은 설명" : "Short description"} value={form.shortDescription} onChange={(event) => update("shortDescription", event.target.value)} />
      <textarea required className="form-field min-h-40" placeholder={language === "ko" ? "전체 설명" : "Full description"} value={form.fullDescription} onChange={(event) => update("fullDescription", event.target.value)} />
      <input className="form-field" placeholder={language === "ko" ? "이미지 URL 또는 이미지 업로드 자리표시자" : "Image URL or image upload placeholder"} value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} />
      <input className="form-field" placeholder={language === "ko" ? "태그, 쉼표로 구분" : "Tags, separated by commas"} value={form.tags} onChange={(event) => update("tags", event.target.value)} />
      <textarea className="form-field min-h-28" placeholder={language === "ko" ? "메시지" : "Message"} value={form.message} onChange={(event) => update("message", event.target.value)} />
      <div>
        <CTAButton type="submit" disabled={submitting}>
          {submitting
            ? language === "ko"
              ? "제출 중..."
              : "Submitting..."
            : language === "ko"
              ? "검토 대기 프로젝트 제출"
              : "Submit Pending Project"}
        </CTAButton>
      </div>
      {success ? (
        <p className="text-sm font-semibold text-pine">
          <I18nText
            en="Project submission saved to Supabase and marked pending review."
            ko="프로젝트 제출 내용이 Supabase에 저장되었고 검토 대기 상태로 표시되었습니다."
          />
        </p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </form>
  );
}
