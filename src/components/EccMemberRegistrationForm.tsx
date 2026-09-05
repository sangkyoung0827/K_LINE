"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  Edit3,
  Loader2,
  Save,
  ShieldCheck
} from "lucide-react";
import {
  defaultEccRegistrationContent,
  type EccRegistrationContent
} from "@/data/eccRegistrationContent";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import { useEccAccess } from "@/hooks/useEccAccess";

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
  teamChatUrl?: string;
};

type RegistrationContentResponse = {
  content?: EccRegistrationContent;
  error?: string;
};

type OperationsResponse = {
  settings?: {
    inquiryChatUrl?: string;
    newMemberOpenChatUrl?: string;
  };
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
  const access = useEccAccess();
  const pathname = usePathname();
  const loginHref = `/login?callbackUrl=${encodeURIComponent(pathname || "/ecc-join")}`;
  const [registration, setRegistration] = useState<EccMemberRegistration | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [registrationContent, setRegistrationContent] = useState<EccRegistrationContent>(
    defaultEccRegistrationContent
  );
  const [contentDraft, setContentDraft] = useState<EccRegistrationContent>(
    defaultEccRegistrationContent
  );
  const [editingContent, setEditingContent] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [contentError, setContentError] = useState("");
  const [inquiryChatUrl, setInquiryChatUrl] = useState("{inquiryChatUrl}");

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

  useEffect(() => {
    let active = true;

    fetch("/api/ecc/registration-content")
      .then(async (response) => ({ data: (await response.json()) as RegistrationContentResponse, response }))
      .then(({ data, response }) => {
        if (!active || !response.ok || !data.content) return;
        setRegistrationContent(data.content);
        setContentDraft(data.content);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/ecc/operations")
      .then((response) => response.json() as Promise<OperationsResponse>)
      .then((data) => {
        if (active && data.settings?.inquiryChatUrl) {
          setInquiryChatUrl(data.settings.inquiryChatUrl);
        }
      })
      .catch(() => undefined);

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

  const beginContentEditing = (startFresh = false) => {
    if (!access.isAdmin) return;

    setContentError("");
    setContentDraft(
      startFresh
        ? { body: "", title: "", updatedAt: registrationContent.updatedAt }
        : registrationContent
    );
    setEditingContent(true);
  };

  const saveContent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingContent(true);
    setContentError("");

    try {
      const response = await fetch("/api/ecc/registration-content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: contentDraft.body, title: contentDraft.title })
      });
      const data = (await response.json()) as RegistrationContentResponse;

      if (!response.ok || !data.content) {
        throw new Error(data.error || "ECC registration content could not be saved.");
      }

      setRegistrationContent(data.content);
      setContentDraft(data.content);
      setEditingContent(false);
    } catch (saveError) {
      setContentError(
        saveError instanceof Error ? saveError.message : "ECC registration content could not be saved."
      );
    } finally {
      setSavingContent(false);
    }
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

      if (data.teamChatUrl) {
        window.location.assign(data.teamChatUrl);
        return;
      }

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
      <section className="paper-panel p-5 md:p-8">
        <div className="grid gap-6">
          {!editingContent ? (
            <div
              role={access.isAdmin ? "button" : undefined}
              tabIndex={access.isAdmin ? 0 : undefined}
              onClick={() => beginContentEditing()}
              onKeyDown={(event) => {
                if (access.isAdmin && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  beginContentEditing();
                }
              }}
              className={access.isAdmin ? "cursor-text rounded-lg outline-none transition hover:bg-hanji/45 focus-visible:ring-2 focus-visible:ring-navy/35" : undefined}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm font-semibold uppercase text-brass">Membership Fee</p>
                {access.isAdmin ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      beginContentEditing();
                    }}
                    className="inline-flex min-h-9 items-center gap-1.5 border border-navy/18 bg-white/65 px-3 text-xs font-semibold text-navy transition hover:border-brass hover:bg-brass/10"
                  >
                    <Edit3 aria-hidden className="h-3.5 w-3.5" />
                    본문 편집
                  </button>
                ) : null}
              </div>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
                {registrationContent.title}
              </h2>
              <div className="mt-5 whitespace-pre-line text-sm leading-7 text-ink/72">
                {registrationContent.body}
              </div>
            </div>
          ) : (
            <form onSubmit={saveContent} className="grid gap-4 rounded-lg border border-brass/35 bg-hanji/35 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase text-brass">관리자 안내문 편집</p>
                <button
                  type="button"
                  disabled={savingContent}
                  onClick={() => beginContentEditing(true)}
                  className="min-h-9 border border-navy/18 bg-white/65 px-3 text-xs font-semibold text-navy transition hover:border-brass hover:bg-brass/10 disabled:opacity-60"
                >
                  새로 작성
                </button>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                제목
                <input
                  required
                  value={contentDraft.title}
                  onChange={(event) => setContentDraft((current) => ({ ...current, title: event.target.value }))}
                  className="form-field min-h-11 w-full"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                본문
                <textarea
                  required
                  rows={18}
                  value={contentDraft.body}
                  onChange={(event) => setContentDraft((current) => ({ ...current, body: event.target.value }))}
                  className="form-field min-h-80 w-full resize-y py-3"
                />
              </label>
              {contentError ? <p role="alert" className="text-sm font-semibold text-red-700">{contentError}</p> : null}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={savingContent}
                  className="inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy disabled:cursor-wait disabled:opacity-60"
                >
                  {savingContent ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Save aria-hidden className="h-4 w-4" />}
                  변경내용 저장하기
                </button>
                <button
                  type="button"
                  disabled={savingContent}
                  onClick={() => {
                    setContentDraft(registrationContent);
                    setContentError("");
                    setEditingContent(false);
                  }}
                  className="min-h-11 border border-navy/18 bg-white/65 px-5 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10 disabled:opacity-60"
                >
                  취소
                </button>
              </div>
            </form>
          )}
          <div className="border border-pine/20 bg-pine/10 p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck aria-hidden className="h-5 w-5 text-pine" />
              <h3 className="font-serif text-2xl font-semibold text-ink">
                Google account connection
              </h3>
            </div>
            <p className="mt-4 text-sm leading-7 text-ink/68">
              This K_LINE form is connected to the Google account you use to log in. Officers
              can verify your payment and approve the same account as an official ECC member.
            </p>
          </div>
        </div>
      </section>

      <section className="paper-panel p-5 md:p-8">
        <p className="text-sm font-semibold uppercase text-brass">📢 문의</p>
        <p className="mt-3 text-sm leading-7 text-ink/72">
          궁금한 점이 있다면 아래 오픈채팅으로 편하게 문의해주세요!
        </p>
        <p className="mt-3 text-sm leading-7 text-ink/72">
          <a
            href={inquiryChatUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-navy underline decoration-brass/70 underline-offset-4 transition hover:text-brass"
          >
            {inquiryChatUrl}
          </a>{" "}
          또는 인스타그램{" "}
          <a
            href="https://www.instagram.com/ecc_jbnu/#"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-navy underline decoration-brass/70 underline-offset-4 transition hover:text-brass"
          >
            ecc_jbnu
          </a>
        </p>
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
            href={loginHref}
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
              ["Google Email", registration.googleEmail],
              [
                "Payment Status",
                registration.paymentConfirmed
                  ? language === "ko"
                    ? "회비 납부 확인 완료"
                    : "Payment confirmed"
                  : language === "ko"
                    ? "회비 확인 대기 중"
                    : "Waiting for payment confirmation"
              ],
              [
                "Official Member Status",
                registration.officialMember || registration.status === "approved"
                  ? language === "ko"
                    ? "정식회원 승인 완료"
                    : "Official member approved"
                  : language === "ko"
                    ? "정식회원 승인 대기 중"
                    : "Waiting for official member approval"
              ]
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
