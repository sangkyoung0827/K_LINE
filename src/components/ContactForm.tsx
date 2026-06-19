"use client";

import { useState } from "react";
import { CTAButton } from "@/components/CTAButton";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

const initialState = {
  inquiryType: "General inquiry",
  name: "",
  email: "",
  message: ""
};

const inquiryOptions = [
  {
    value: "General inquiry",
    label: { en: "General inquiry", ko: "일반 문의" }
  },
  {
    value: "K-Culture Project inquiry",
    label: { en: "K-Culture Project inquiry", ko: "K-컬처 프로젝트 문의" }
  },
  {
    value: "International Clubs inquiry",
    label: { en: "International Clubs inquiry", ko: "국제 학생 클럽 문의" }
  },
  {
    value: "Hanhwal project inquiry",
    label: { en: "Hanhwal project inquiry", ko: "한활 프로젝트 문의" }
  }
];

export function ContactForm() {
  const [form, setForm] = useState(initialState);
  const [success, setSuccess] = useState(false);
  const { language } = useLanguage();

  const update = (field: keyof typeof initialState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = { ...form, createdAt: new Date().toISOString() };
    const key = "k_line_contact_inquiries";
    const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]") as typeof payload[];
    window.localStorage.setItem(key, JSON.stringify([...existing, payload]));
    // Future integration point: forward contact inquiries to email, backend storage, and admin dashboard queues.
    setForm(initialState);
    setSuccess(true);
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-4 p-5 md:p-8">
      <h2 className="font-serif text-3xl font-semibold text-ink">
        <I18nText en="Contact K_LINE" ko="K_LINE 문의" />
      </h2>
      <select className="form-field" value={form.inquiryType} onChange={(event) => update("inquiryType", event.target.value)}>
        {inquiryOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label[language]}
          </option>
        ))}
      </select>
      <div className="grid gap-4 md:grid-cols-2">
        <input required className="form-field" placeholder={language === "ko" ? "이름" : "Name"} value={form.name} onChange={(event) => update("name", event.target.value)} />
        <input required type="email" className="form-field" placeholder="Email" value={form.email} onChange={(event) => update("email", event.target.value)} />
      </div>
      <textarea required className="form-field min-h-36" placeholder={language === "ko" ? "문의 내용" : "Message"} value={form.message} onChange={(event) => update("message", event.target.value)} />
      <div>
        <CTAButton type="submit">
          <I18nText en="Send Contact Inquiry" ko="문의 보내기" />
        </CTAButton>
      </div>
      {success ? (
        <p className="text-sm font-semibold text-pine">
          <I18nText
            en="Contact inquiry saved locally. Email/backend connection can be added later."
            ko="문의가 로컬에 저장되었습니다. 이메일/백엔드 연결은 이후 추가할 수 있습니다."
          />
        </p>
      ) : null}
    </form>
  );
}
