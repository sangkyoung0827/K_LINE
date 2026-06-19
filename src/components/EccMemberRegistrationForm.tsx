"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  Loader2,
  MessageCircle,
  ShieldCheck
} from "lucide-react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import { eccRegistrationConfig } from "@/data/eccRegistration";

type RegistrationStatus = "submitted" | "payment_pending" | "approved" | "rejected";

type EccMemberRegistration = {
  id: string;
  googleEmail: string;
  googleName: string;
  googleAvatarUrl: string;
  fullName: string;
  studentId: string;
  departmentOrMajor: string;
  nationality: string;
  gender: string;
  kakaoDisplayName: string;
  kakaoId: string;
  paymentConfirmed: boolean;
  officialMember: boolean;
  status: RegistrationStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
};

type RegistrationResponse = {
  error?: string;
  message?: string;
  registration?: EccMemberRegistration | null;
};

type FormState = {
  departmentOrMajor: string;
  fullName: string;
  gender: string;
  kakaoDisplayName: string;
  kakaoId: string;
  nationality: string;
  studentId: string;
};

type FormField = keyof FormState;

const emptyForm: FormState = {
  departmentOrMajor: "",
  fullName: "",
  gender: "",
  kakaoDisplayName: "",
  kakaoId: "",
  nationality: "",
  studentId: ""
};

const requiredError = {
  en: "This field is required.",
  ko: "필수 입력 항목입니다."
};

const flowItems = [
  {
    en: "Join ECC Open Chat",
    ko: "ECC 오픈채팅방 입장"
  },
  {
    en: "Log in to K_LINE with Google",
    ko: "K_LINE에 Google 계정으로 로그인"
  },
  {
    en: "Submit the K_LINE new member form",
    ko: "K_LINE 내부 신규회원 등록폼 제출"
  },
  {
    en: "Pay the membership fee",
    ko: "회비 납부"
  },
  {
    en: "Wait for officer confirmation",
    ko: "운영진 확인 후 정식회원 등록 완료"
  }
];

const genderOptions = [
  { en: "Male", ko: "남성", value: "Male" },
  { en: "Female", ko: "여성", value: "Female" },
  { en: "Etc", ko: "기타", value: "Etc" },
  { en: "Prefer not to say", ko: "밝히고 싶지 않음", value: "Prefer not to say" }
];

function registrationToForm(registration: EccMemberRegistration | null): FormState {
  if (!registration) {
    return emptyForm;
  }

  return {
    departmentOrMajor: registration.departmentOrMajor,
    fullName: registration.fullName,
    gender: registration.gender,
    kakaoDisplayName: registration.kakaoDisplayName,
    kakaoId: registration.kakaoId,
    nationality: registration.nationality,
    studentId: registration.studentId
  };
}

function statusText(registration: EccMemberRegistration, language: "en" | "ko") {
  if (registration.officialMember || registration.status === "approved") {
    return language === "ko" ? "정식회원 승인 완료" : "Official member approved";
  }

  if (registration.status === "rejected") {
    return language === "ko" ? "수정 또는 재확인 필요" : "Needs update or review";
  }

  return language === "ko" ? "회비 확인 대기 중" : "Waiting for payment confirmation";
}

function statusDescription(registration: EccMemberRegistration, language: "en" | "ko") {
  if (registration.officialMember || registration.status === "approved") {
    return language === "ko"
      ? "이 Google 계정은 ECC 정식회원으로 승인되었습니다. ECC OFFICIAL에서 팀채팅 링크와 QR을 확인할 수 있습니다."
      : "This Google account is approved as an ECC official member. You can open the protected team chat link and QR in ECC OFFICIAL.";
  }

  if (registration.status === "rejected") {
    return language === "ko"
      ? "운영진 확인이 필요합니다. 정보가 잘못되었다면 수정 후 다시 제출해 주세요."
      : "Officer review is needed. If any information is wrong, edit and submit it again.";
  }

  return language === "ko"
    ? "등록은 완료되었습니다. 운영진이 회비 납부를 확인하면 정식회원 권한이 열립니다."
    : "Your registration is submitted. ECC officers will approve official membership after confirming payment.";
}

export function EccMemberRegistrationForm() {
  const { language } = useLanguage();
  const openChatUrl = eccRegistrationConfig.openChatUrl;
  const [registration, setRegistration] = useState<EccMemberRegistration | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/ecc/member-registration")
      .then((response) =>
        response.json().then((data: RegistrationResponse) => ({
          data,
          response
        }))
      )
      .then(({ data, response }) => {
        if (!active) {
          return;
        }

        if (response.status === 401) {
          setLoginRequired(true);
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "ECC registration could not be loaded.");
        }

        const loadedRegistration = data.registration ?? null;
        setRegistration(loadedRegistration);
        setForm(registrationToForm(loadedRegistration));
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "ECC registration could not be loaded.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const canEdit = useMemo(
    () => !registration || (!registration.officialMember && registration.status !== "approved"),
    [registration]
  );
  const showForm = !registration || editing;

  const updateForm = (field: FormField, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
    setFieldErrors((current) => ({
      ...current,
      [field]: ""
    }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const missingFields = (Object.keys(form) as FormField[]).filter((field) => !form[field].trim());

      if (missingFields.length > 0) {
        setFieldErrors(
          Object.fromEntries(
            missingFields.map((field) => [field, language === "ko" ? requiredError.ko : requiredError.en])
          )
        );
        setError(
          language === "ko"
            ? "필수 항목을 모두 입력해 주세요."
            : "Please fill in all required fields."
        );
        return;
      }

      const response = await fetch("/api/ecc/member-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as RegistrationResponse;

      if (!response.ok) {
        throw new Error(data.error || "ECC registration could not be submitted.");
      }

      setRegistration(data.registration ?? null);
      setForm(registrationToForm(data.registration ?? null));
      setFieldErrors({});
      setEditing(false);
      setMessage(
        language === "ko"
          ? "ECC 신규회원 등록이 제출되었습니다. 운영진이 회비 납부를 확인하면 정식회원 권한이 열립니다."
          : data.message ||
              "Your ECC registration has been submitted. ECC officers will check your payment and approve your official membership soon."
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ECC registration could not be submitted.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-8">
      <section className="paper-panel grid gap-6 p-5 md:p-8 lg:grid-cols-[1.1fr_260px]">
        <div>
          <div className="inline-flex items-center gap-2 border border-brass/25 bg-brass/10 px-3 py-2 text-xs font-semibold uppercase text-brass">
            <MessageCircle aria-hidden className="h-4 w-4" />
            <I18nText en="ECC Open Chat first" ko="오픈채팅 먼저 입장" />
          </div>
          <h2 className="mt-5 font-serif text-4xl font-semibold text-ink">
            <I18nText en="ECC New Member Registration" ko="ECC 신규회원 등록" />
          </h2>
          <p className="mt-5 text-base leading-8 text-ink/68">
            <I18nText
              en="ECC uses KakaoTalk Open Chat as the first step for new member guidance. After checking the guide, log in with Google and submit this K_LINE registration form."
              ko="ECC 신규회원 등록은 먼저 오픈채팅방 입장 후 안내를 확인하는 방식으로 진행됩니다. 안내를 확인한 뒤 Google로 로그인하고 K_LINE 내부 등록폼을 제출해 주세요."
            />
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={openChatUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-paper shadow-sm transition hover:-translate-y-0.5 hover:bg-navy"
            >
              <ExternalLink aria-hidden className="h-4 w-4" />
              <I18nText en="Join ECC Open Chat" ko="ECC 오픈채팅방 입장하기" />
            </a>
            <a
              href="/api/ecc/open-chat-qr"
              download
              className="inline-flex min-h-11 items-center gap-2 border border-navy/20 px-5 py-3 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-brass hover:bg-brass/15"
            >
              <Download aria-hidden className="h-4 w-4" />
              <I18nText en="Download QR" ko="QR 다운로드" />
            </a>
          </div>
        </div>

        <div className="hidden content-start gap-4 md:grid">
          <img
            src="/api/ecc/open-chat-qr"
            alt={
              language === "ko"
                ? "ECC 오픈채팅방으로 연결되는 QR 코드"
                : "QR code linking to ECC KakaoTalk Open Chat"
            }
            className="aspect-square w-full border border-ink/10 bg-white object-contain p-3"
          />
          <p className="break-all text-sm leading-7 text-ink/58">{openChatUrl}</p>
        </div>
      </section>

      <section className="paper-panel p-5 md:p-8">
        <p className="text-sm font-semibold uppercase text-brass">
          <I18nText en="Registration flow" ko="등록 절차" />
        </p>
        <div className="mt-5 grid gap-3">
          {flowItems.map((item, index) => (
            <div key={item.en} className="flex items-start gap-4 border border-ink/10 bg-white/50 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-navy text-sm font-semibold text-paper">
                {index + 1}
              </span>
              <p className="pt-1 text-sm font-semibold text-ink">
                <I18nText en={item.en} ko={item.ko} />
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="paper-panel p-5 md:p-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <p className="text-sm font-semibold uppercase text-brass">
              <I18nText en="Payment guide" ko="회비 안내" />
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="border border-ink/10 bg-white/45 p-4">
                <p className="text-xs font-semibold uppercase text-brass">Korean</p>
                <div className="mt-3 whitespace-pre-line text-sm leading-7 text-ink/72">{`👋 Welcome to ECC!

ECC 신입 회원 신청(Registration form for new Club Members)
✅️클럽 회원 등록✅️

💸회비: 15,000원
📬입금계좌: [ 3333-30-3496426 / ECC OFICIAL ]
💶현금:

9월 11일(금)까지 17:00 - 18:00, 동아리 전용관 2층, ECC 동아리방

감사합니다! 😊`}</div>
              </div>
              <div className="border border-ink/10 bg-white/45 p-4">
                <p className="text-xs font-semibold uppercase text-brass">English</p>
                <div className="mt-3 whitespace-pre-line text-sm leading-7 text-ink/72">{`✅ Please fill out this form after checking the membership fee information.

💳 Membership Fee
Amount: [ 15,000 ] KRW
Bank Account: [ 3333-30-3496426 / ECC OFICIAL ]

💵 No Korean bank account?
You can pay in cash at an ECC office.

💶 Cash: Until September 11th(FRI) from 17:00 to 18:00, ECC room on the 2nd floor of 동아리 전용관

📌 Please write your information correctly.
ECC officers will check your form and payment.

📷 Instagram: [ecc_jbnu]

Thank you! 💚`}</div>
              </div>
            </div>
          </div>
          <div className="border border-pine/20 bg-pine/10 p-5 lg:col-span-2">
            <div className="flex items-center gap-3">
              <ShieldCheck aria-hidden className="h-5 w-5 text-pine" />
              <h3 className="font-serif text-2xl font-semibold text-ink">
                <I18nText en="Google account connection" ko="Google 계정 연결" />
              </h3>
            </div>
            <p className="mt-4 text-sm leading-7 text-ink/68">
              <I18nText
                en="This K_LINE form is connected to the Google account you use to log in. Officers can verify your payment and approve the same account as an official ECC member."
                ko="이 K_LINE 등록폼은 로그인한 Google 계정과 연결됩니다. 운영진은 회비 납부를 확인한 뒤 같은 계정을 ECC 정식회원으로 승인할 수 있습니다."
              />
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="paper-panel flex items-center gap-3 p-6 text-sm font-semibold text-ink/62">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          <I18nText en="Loading your registration status..." ko="등록 상태를 불러오는 중..." />
        </div>
      ) : null}

      {!loading && loginRequired ? (
        <section className="paper-panel p-5 md:p-8">
          <h2 className="font-serif text-3xl font-semibold text-ink">
            <I18nText en="Login is required" ko="로그인이 필요합니다" />
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink/68">
            <I18nText
              en="Please log in with Google before submitting the ECC new member registration form."
              ko="ECC 신규회원 등록폼을 제출하려면 먼저 Google 계정으로 로그인해 주세요."
            />
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
          >
            <I18nText en="Go to Login" ko="로그인하러 가기" />
          </Link>
        </section>
      ) : null}

      {!loading && !loginRequired && registration && !editing ? (
        <section className="paper-panel p-5 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 border border-pine/20 bg-pine/10 px-3 py-2 text-xs font-semibold uppercase text-pine">
                <CheckCircle2 aria-hidden className="h-4 w-4" />
                {statusText(registration, language)}
              </div>
              <h2 className="mt-5 font-serif text-3xl font-semibold text-ink">
                <I18nText en="Registration submitted" ko="등록이 제출되었습니다" />
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/68">
                {statusDescription(registration, language)}
              </p>
            </div>
            {registration.googleAvatarUrl ? (
              <img
                src={registration.googleAvatarUrl}
                alt=""
                className="h-14 w-14 rounded-full border border-ink/10 object-cover"
              />
            ) : null}
          </div>

          <dl className="mt-8 grid gap-4 text-sm md:grid-cols-2">
            {[
              ["Full Name / 이름", registration.fullName],
              ["Student ID / 학번", registration.studentId],
              ["Department or Major / 학과 또는 전공", registration.departmentOrMajor],
              ["Nationality / 국적", registration.nationality],
              ["Gender / 성별", registration.gender],
              ["KakaoTalk Display Name / 카카오톡 표시 이름", registration.kakaoDisplayName],
              ["Kakao ID / 카카오톡 ID", registration.kakaoId],
              ["Google Email", registration.googleEmail]
            ].map(([label, value]) => (
              <div key={label} className="border border-ink/10 bg-white/45 p-4">
                <dt className="text-xs font-semibold uppercase text-ink/45">{label}</dt>
                <dd className="mt-2 font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {canEdit ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex min-h-11 items-center gap-2 border border-navy/20 px-5 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
              >
                <Edit3 aria-hidden className="h-4 w-4" />
                <I18nText en="Edit Registration" ko="등록 정보 수정" />
              </button>
            ) : (
              <Link
                href="/ecc-official"
                className="inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
              >
                <I18nText en="Open ECC OFFICIAL" ko="ECC OFFICIAL 열기" />
              </Link>
            )}
            {registration.adminNote ? (
              <p className="text-sm font-semibold text-brass">{registration.adminNote}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {!loading && !loginRequired && showForm ? (
        <form onSubmit={submit} className="paper-panel grid gap-5 p-5 md:p-8">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">
              <I18nText en="K_LINE registration form" ko="K_LINE 신규회원 등록폼" />
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
              <I18nText en="Official ECC member request" ko="ECC 정식회원 신청" />
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Full Name / 이름"
              error={fieldErrors.fullName}
              value={form.fullName}
              onChange={(value) => updateForm("fullName", value)}
            />
            <TextField
              label="Student ID / 학번"
              error={fieldErrors.studentId}
              value={form.studentId}
              onChange={(value) => updateForm("studentId", value)}
            />
            <TextField
              label="Department or Major / 학과 또는 전공"
              error={fieldErrors.departmentOrMajor}
              value={form.departmentOrMajor}
              onChange={(value) => updateForm("departmentOrMajor", value)}
            />
            <TextField
              label="Nationality / 국적"
              error={fieldErrors.nationality}
              value={form.nationality}
              onChange={(value) => updateForm("nationality", value)}
            />
            <TextField
              label="KakaoTalk Display Name / 카카오톡 표시 이름"
              error={fieldErrors.kakaoDisplayName}
              value={form.kakaoDisplayName}
              onChange={(value) => updateForm("kakaoDisplayName", value)}
            />
            <TextField
              label="Kakao ID / 카카오톡 ID"
              error={fieldErrors.kakaoId}
              helper={
                language === "ko"
                  ? "카카오톡 공유 메뉴에서 확인할 수 있는 ID를 입력해 주세요."
                  : "Enter the ID shown in the KakaoTalk sharing menu."
              }
              value={form.kakaoId}
              onChange={(value) => updateForm("kakaoId", value)}
            />
          </div>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold text-ink">Gender / 성별</legend>
            <div className="grid gap-3 md:grid-cols-4">
              {genderOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex min-h-12 cursor-pointer items-center gap-2 border px-4 text-sm font-semibold transition ${
                    form.gender === option.value
                      ? "border-navy bg-navy text-paper"
                      : "border-ink/10 bg-white/45 text-ink hover:border-brass"
                  }`}
                >
                  <input
                    required
                    type="radio"
                    name="gender"
                    value={option.value}
                    checked={form.gender === option.value}
                    onChange={(event) => updateForm("gender", event.target.value)}
                    className="sr-only"
                  />
                  <span>
                    <I18nText en={option.en} ko={option.ko} />
                  </span>
                </label>
              ))}
            </div>
            {fieldErrors.gender ? (
              <p className="text-xs font-semibold text-red-700">{fieldErrors.gender}</p>
            ) : null}
          </fieldset>

          <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-ink/10 bg-paper/95 p-4 pt-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 bg-ink px-6 text-sm font-semibold text-paper transition hover:bg-navy disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
            >
              {saving ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
              {saving ? (
                <I18nText en="Submitting..." ko="제출 중..." />
              ) : (
                <I18nText en="Submit Registration" ko="등록 제출" />
              )}
            </button>
            {registration && editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm(registrationToForm(registration));
                  setFieldErrors({});
                  setError("");
                }}
                className="inline-flex min-h-12 flex-1 items-center justify-center border border-navy/20 px-6 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15 md:flex-none"
              >
                <I18nText en="Cancel" ko="취소" />
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {message ? <p className="text-sm font-semibold text-pine">{message}</p> : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

function TextField({
  error,
  helper,
  label,
  onChange,
  value
}: {
  error?: string;
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      <input
        required
        aria-invalid={Boolean(error)}
        className="form-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="text-xs font-semibold leading-5 text-red-700">{error}</span> : null}
      {helper ? <span className="text-xs font-normal leading-5 text-ink/54">{helper}</span> : null}
    </label>
  );
}
