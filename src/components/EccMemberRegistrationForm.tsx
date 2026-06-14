"use client";

import { useState } from "react";
import { CTAButton } from "@/components/CTAButton";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

const initialForm = {
  name: "",
  kakaoId: "",
  email: "",
  phone: "",
  nationality: "",
  note: ""
};

export function EccMemberRegistrationForm() {
  const [form, setForm] = useState(initialForm);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { language } = useLanguage();

  const update = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSuccess(false);
    setError("");

    try {
      const response = await fetch("/api/ecc/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "ECC member registration could not be saved.");
      }

      setForm(initialForm);
      setSuccess(true);
    } catch (registrationError) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : "ECC member registration could not be saved."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-5 p-5 md:p-8">
      <div>
        <h2 className="font-serif text-3xl font-semibold text-ink">
          <I18nText en="ECC New Member Registration" ko="ECC 신규 회원 등록" />
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink/68">
          <I18nText
            en="Register your name and KakaoTalk ID first. Officers will confirm the membership fee, then prepare the team chat invitation."
            ko="먼저 이름과 카카오톡 ID를 등록해 주세요. 임원이 회비 납부를 확인한 뒤 팀채팅 초대를 준비합니다."
          />
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <input
          required
          className="form-field"
          placeholder={language === "ko" ? "이름" : "Name"}
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
        />
        <input
          required
          className="form-field"
          placeholder={language === "ko" ? "카카오톡 ID 또는 등록 이름" : "KakaoTalk ID or display name"}
          value={form.kakaoId}
          onChange={(event) => update("kakaoId", event.target.value)}
        />
        <input
          type="email"
          className="form-field"
          placeholder={language === "ko" ? "이메일" : "Email"}
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
        />
        <input
          className="form-field"
          placeholder={language === "ko" ? "전화번호 또는 연락처" : "Phone or contact"}
          value={form.phone}
          onChange={(event) => update("phone", event.target.value)}
        />
        <input
          className="form-field"
          placeholder={language === "ko" ? "국적" : "Nationality"}
          value={form.nationality}
          onChange={(event) => update("nationality", event.target.value)}
        />
      </div>

      <textarea
        className="form-field min-h-28"
        placeholder={language === "ko" ? "기타 요청사항 또는 임원에게 남길 말" : "Other requests or note for officers"}
        value={form.note}
        onChange={(event) => update("note", event.target.value)}
      />

      <div>
        <CTAButton type="submit" disabled={submitting}>
          {submitting
            ? language === "ko"
              ? "등록 중..."
              : "Submitting..."
            : language === "ko"
              ? "신규 회원 등록"
              : "Submit Registration"}
        </CTAButton>
      </div>

      {success ? (
        <div className="border border-pine/25 bg-pine/10 p-4 text-sm leading-7 text-ink">
          <p className="font-semibold text-pine">
            <I18nText en="Registration submitted." ko="등록되었습니다." />
          </p>
          <p className="mt-2 text-ink/68">
            <I18nText
              en="If the membership fee is not paid yet, please complete the payment according to the officer's guide. Team chat invitations are prepared after fee confirmation."
              ko="아직 회비를 납부하지 않았다면 임원의 안내에 따라 회비를 납부해 주세요. 팀채팅 초대는 회비 납부 확인 후 준비됩니다."
            />
          </p>
        </div>
      ) : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </form>
  );
}
