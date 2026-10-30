"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Edit3,
  FileText,
  Loader2,
  MessageCircle,
  Settings,
  ShieldCheck
} from "lucide-react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import styles from "./HanhwalJoinForm.module.css";

type RegistrationStatus = "submitted" | "payment_pending" | "approved" | "rejected";

type HanhwalMemberRegistration = {
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
  registration?: HanhwalMemberRegistration | null;
  teamChatPath?: string;
  teamChatDescriptionKo?: string;
  teamChatDescriptionEn?: string;
  periodLabel?: string;
  canManageTeamChat?: boolean;
  teamChatUnavailable?: boolean;
  access?: { isOfficialMember?: boolean };
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

function registrationToForm(registration: HanhwalMemberRegistration | null): FormState {
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

function statusText(registration: HanhwalMemberRegistration, language: "en" | "ko", approved = false) {
  if (approved || registration.officialMember || registration.status === "approved") {
    return language === "ko" ? "정식회원 승인 완료" : "Official member approved";
  }

  if (registration.status === "rejected") {
    return language === "ko" ? "수정 또는 재확인 필요" : "Needs update or review";
  }

  return language === "ko" ? "회비 확인 대기 중" : "Waiting for payment confirmation";
}

function statusDescription(registration: HanhwalMemberRegistration, language: "en" | "ko", approved = false) {
  if (approved || registration.officialMember || registration.status === "approved") {
    return language === "ko"
      ? "이 Google 계정은 Hanhwal 정식회원으로 승인되었습니다. Hanhwal OFFICIAL에서 팀채팅 링크와 QR을 확인할 수 있습니다."
      : "This Google account is approved as an Hanhwal official member. You can open the protected team chat link and QR in Hanhwal OFFICIAL.";
  }

  if (registration.status === "rejected") {
    return language === "ko"
      ? "운영진 확인이 필요합니다. 정보가 잘못되었다면 수정 후 다시 제출해 주세요."
      : "Officer review is needed. If any information is wrong, edit and submit it again.";
  }

  return language === "ko"
    ? "등록은 완료되었습니다. 운영진이 회비 납부를 확인하면 정식회원 권한이 열립니다."
    : "Your registration is submitted. Hanhwal officers will approve official membership after confirming payment.";
}

export function HanhwalMemberRegistrationForm({ variant = "default", intro }: { variant?: "default" | "site"; intro?: React.ReactNode }) {
  const isSite = variant === "site";
  const { language } = useLanguage();
  const pathname = usePathname();
  const loginHref = `/login?callbackUrl=${encodeURIComponent(pathname || "/hanhwal-join")}`;
  const [registration, setRegistration] = useState<HanhwalMemberRegistration | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [teamChatPath, setTeamChatPath] = useState("");
  const [teamChatDescription, setTeamChatDescription] = useState({ ko: "", en: "" });
  const [periodLabel, setPeriodLabel] = useState("");
  const [canManageTeamChat, setCanManageTeamChat] = useState(false);
  const [teamChatUnavailable, setTeamChatUnavailable] = useState(false);
  const [officialAccess, setOfficialAccess] = useState(false);
  const refreshAllowed = useRef(false);

  useEffect(() => {
    refreshAllowed.current = (Boolean(registration) || officialAccess) && !editing && !saving;
  }, [registration, officialAccess, editing, saving]);

  useEffect(() => {
    let active = true;
    let latestRequest = 0;

    const load = (refresh = false) => {
      const currentRequest = ++latestRequest;
      return fetch("/api/hanhwal/member-registration", { cache: "no-store" })
      .then((response) =>
        response.json().then((data: RegistrationResponse) => ({
          data,
          response
        }))
      )
      .then(({ data, response }) => {
        if (!active || currentRequest !== latestRequest || (refresh && !refreshAllowed.current)) {
          return;
        }

        if (response.status === 401) {
          setLoginRequired(true);
          setTeamChatPath("");
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Hanhwal registration could not be loaded.");
        }

        const loadedRegistration = data.registration ?? null;
        setLoginRequired(false);
        setError("");
        setRegistration(loadedRegistration);
        if (!refresh) setForm(registrationToForm(loadedRegistration));
        setTeamChatPath(data.teamChatPath === "/api/hanhwal/team-chat" ? data.teamChatPath : "");
        setTeamChatDescription({ ko: data.teamChatDescriptionKo ?? "", en: data.teamChatDescriptionEn ?? "" });
        setPeriodLabel(data.periodLabel ?? "");
        setCanManageTeamChat(Boolean(data.canManageTeamChat));
        setOfficialAccess(Boolean(data.access?.isOfficialMember));
        setTeamChatUnavailable(Boolean(data.teamChatUnavailable));
      })
      .catch((loadError) => {
        if (!active || currentRequest !== latestRequest || (refresh && !refreshAllowed.current)) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Hanhwal registration could not be loaded.");
      })
      .finally(() => {
        if (active && currentRequest === latestRequest && !refresh) {
          setLoading(false);
        }
      });
    };
    void load();
    const refresh = () => { if (refreshAllowed.current) void load(true); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", restore);

    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", restore);
    };
  }, []);

  const approved = officialAccess || Boolean(registration?.officialMember || registration?.status === "approved");
  const canEdit = !approved;
  const showForm = (!registration && !approved) || editing;
  const membershipActions = (
    <div className={styles.memberActions}>
      {approved ? <Link href="/hanhwal-official" className={styles.secondaryAction}>
        <ShieldCheck aria-hidden className="h-4 w-4 shrink-0" /><I18nText en="Hanhwal OFFICIAL" ko="한활 공식 메뉴" />
      </Link> : null}
      {teamChatPath ? <a href={teamChatPath} className={styles.primaryAction}>
        <MessageCircle aria-hidden className="h-4 w-4 shrink-0" /><I18nText en="Join Hanhwal team chat" ko="한활 팀채팅 입장하기" />
      </a> : null}
    </div>
  );
  const teamChatInstructions = teamChatPath && teamChatDescription[language]
    ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink/68">{teamChatDescription[language]}</p> : null;
  const managementLink = canManageTeamChat ? (
    <Link href="/our-activities/hanhwal/operations" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4">
      <Settings aria-hidden className="h-4 w-4" /><I18nText en="Team chat settings" ko="팀채팅 설정" />
    </Link>
  ) : null;

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
    if (saving) return;
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

      const response = await fetch("/api/hanhwal/member-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as RegistrationResponse;

      if (!response.ok) {
        throw new Error(data.error || "Hanhwal registration could not be submitted.");
      }
      if (!data.registration) throw new Error("Hanhwal registration was not saved. Please try again.");

      setRegistration(data.registration ?? null);
      setForm(registrationToForm(data.registration ?? null));
      setFieldErrors({});
      setEditing(false);
      setTeamChatPath(data.teamChatPath === "/api/hanhwal/team-chat" ? data.teamChatPath : "");
      setMessage(
        language === "ko"
          ? "Hanhwal 신규회원 등록이 제출되었습니다. 운영진이 회비 납부를 확인하면 정식회원 권한이 열립니다."
          : data.message ||
              "Your Hanhwal registration has been submitted. Hanhwal officers will check your payment and approve your official membership soon."
      );
      if (data.teamChatPath === "/api/hanhwal/team-chat") {
        window.location.assign(data.teamChatPath);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Hanhwal registration could not be submitted.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={isSite ? styles.siteForm : "grid gap-8"}>
      {isSite && !loading && !registration && !officialAccess && !loginRequired ? intro : null}
      {!isSite ? <section className="paper-panel p-5 md:p-8">
        <div className="grid gap-6">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">Membership Fee</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
              Hanhwal New Member Registration
            </h2>
            <div className="mt-5 whitespace-pre-line text-sm leading-7 text-ink/72">{`Welcome to Hanhwal.

Hanhwal is K_LINE's Korean traditional archery club community.
Please submit this form after reviewing the current membership fee and payment instructions shared by the club officers.

Membership confirmation:
Club officers will compare this form with the payment record and approve the connected Google account as an official Hanhwal member.

Notice:
Please enter the same name that you use in KakaoTalk so the officers can identify your application.`}</div>
          </div>
          <div className="border border-pine/20 bg-pine/10 p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck aria-hidden className="h-5 w-5 text-pine" />
              <h3 className="font-serif text-2xl font-semibold text-ink">
                Google account connection
              </h3>
            </div>
            <p className="mt-4 text-sm leading-7 text-ink/68">
              This K_LINE form is connected to the Google account you use to log in. Officers
              can verify your payment and approve the same account as an official Hanhwal member.
            </p>
          </div>
        </div>
      </section> : null}

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
              en="Please log in with Google before submitting the Hanhwal new member registration form."
              ko="한활 신규회원 등록폼을 제출하려면 먼저 Google 계정으로 로그인해 주세요."
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

      {isSite && !loading && !loginRequired && !registration && !officialAccess && !error ? (
        <p className={styles.availableStatus} role="status">
          <I18nText en="Registration form is ready" ko="가입 신청서를 작성할 수 있습니다" />
        </p>
      ) : null}

      {!loading && !loginRequired && !registration && officialAccess ? (
        <section className={`paper-panel ${styles.memberSummary}`}>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-pine"><CheckCircle2 aria-hidden className="h-4 w-4" /><I18nText en="Official member approved" ko="정식회원 승인 완료" /></div>
          {isSite ? <h1 className="font-serif text-2xl font-semibold text-ink"><I18nText en="Welcome to Hanhwal" ko="한활 정식회원입니다" /></h1> : <h2 className="font-serif text-2xl font-semibold text-ink"><I18nText en="Welcome to Hanhwal" ko="한활 정식회원입니다" /></h2>}
          {periodLabel ? <p className="text-sm font-semibold text-ink/65">{periodLabel}</p> : null}
          {membershipActions}
          {teamChatInstructions}
          {managementLink}
          <p className="text-sm text-ink/60"><I18nText en="No registration form has been submitted with this account." ko="이 계정으로 제출된 가입 신청서는 없습니다." /></p>
        </section>
      ) : null}

      {!loading && !loginRequired && registration && !editing ? (
        <section className={`paper-panel ${styles.memberSummary}`}>
          <div className={styles.memberHeader}>
            <div className="grid min-w-0 gap-3">
              <div className="inline-flex items-center gap-2 border border-pine/20 bg-pine/10 px-3 py-2 text-xs font-semibold uppercase text-pine">
                <CheckCircle2 aria-hidden className="h-4 w-4" />
                {statusText(registration, language, approved)}
              </div>
              {isSite ? (
                <h1 className="font-serif text-2xl font-semibold text-ink">
                  {canEdit ? <I18nText en="Registration received" ko="가입 신청이 접수되었습니다" /> : <I18nText en="Welcome to Hanhwal" ko="한활 정식회원입니다" />}
                </h1>
              ) : (
                <h2 className="font-serif text-2xl font-semibold text-ink"><I18nText en="Registration received" ko="가입 신청이 접수되었습니다" /></h2>
              )}
              <p className="max-w-3xl text-sm leading-7 text-ink/68">
                {statusDescription(registration, language, approved)}
              </p>
            </div>
            {registration.googleAvatarUrl ? (
              <img
                src={registration.googleAvatarUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full border border-ink/10 object-cover"
              />
            ) : null}
          </div>

          {periodLabel ? <p className="text-sm font-semibold text-ink/65">{periodLabel}</p> : null}
          {membershipActions}
          {teamChatInstructions}
          {managementLink}
          <details className={styles.submittedDetails}>
            <summary>
              <FileText aria-hidden className="h-4 w-4 shrink-0" />
              <I18nText en="View my submitted form" ko="내가 제출한 신청서 보기" />
              <ChevronDown aria-hidden className={styles.detailsChevron} />
            </summary>
          <dl className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
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
              <div key={label} className="min-w-0 border-b border-ink/10 py-3 [overflow-wrap:anywhere]">
                <dt className="text-xs font-semibold uppercase text-ink/45">{label}</dt>
                <dd className="mt-2 font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          </details>

          <div className="flex flex-wrap items-center gap-3">
            {canEdit ? (
              <button
                type="button"
                onClick={() => { setForm(registrationToForm(registration)); setEditing(true); }}
                className="inline-flex min-h-11 items-center gap-2 border border-navy/20 px-5 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
              >
                <Edit3 aria-hidden className="h-4 w-4" />
                <I18nText en="Edit Registration" ko="등록 정보 수정" />
              </button>
            ) : null}
            {registration.adminNote ? (
              <p className="text-sm font-semibold text-brass">{registration.adminNote}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {!loading && !loginRequired && showForm ? (
        <form onSubmit={submit} className={isSite ? styles.registrationForm : "paper-panel grid gap-5 p-5 md:p-8"}>
          {!isSite ? <div>
            <p className="text-sm font-semibold uppercase text-brass">
              <I18nText en="K_LINE registration form" ko="K_LINE 신규회원 등록폼" />
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
              <I18nText en="Official Hanhwal member request" ko="한활 정식회원 신청" />
            </h2>
          </div> : null}

          <div className={isSite ? styles.fieldsGrid : "grid gap-4 md:grid-cols-2"}>
            <TextField
              label="Full Name / 이름"
              disabled={saving}
              site={isSite}
              placeholder={isSite ? "Your full name" : undefined}
              error={fieldErrors.fullName}
              value={form.fullName}
              onChange={(value) => updateForm("fullName", value)}
            />
            <TextField
              label="Student ID / 학번"
              disabled={saving}
              site={isSite}
              placeholder={isSite ? "Your student ID" : undefined}
              error={fieldErrors.studentId}
              value={form.studentId}
              onChange={(value) => updateForm("studentId", value)}
            />
            <TextField
              label="Department or Major / 학과 또는 전공"
              disabled={saving}
              site={isSite}
              placeholder={isSite ? "e.g. Computer Science" : undefined}
              error={fieldErrors.departmentOrMajor}
              value={form.departmentOrMajor}
              onChange={(value) => updateForm("departmentOrMajor", value)}
            />
            <TextField
              label="Nationality / 국적"
              disabled={saving}
              site={isSite}
              placeholder={isSite ? "e.g. Indonesia" : undefined}
              error={fieldErrors.nationality}
              value={form.nationality}
              onChange={(value) => updateForm("nationality", value)}
            />
            <TextField
              label="KakaoTalk Display Name / 카카오톡 표시 이름"
              disabled={saving}
              site={isSite}
              error={fieldErrors.kakaoDisplayName}
              value={form.kakaoDisplayName}
              onChange={(value) => updateForm("kakaoDisplayName", value)}
            />
            <TextField
              label="Kakao ID / 카카오톡 ID"
              disabled={saving}
              site={isSite}
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
                    disabled={saving}
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

          <div className={isSite ? styles.actions : "sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-ink/10 bg-paper/95 p-4 pt-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:pt-2"}>
            <button
              type="submit"
              disabled={saving}
              className={isSite ? styles.submitButton : "inline-flex min-h-12 flex-1 items-center justify-center gap-2 bg-ink px-6 text-sm font-semibold text-paper transition hover:bg-navy disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"}
            >
              {saving ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
              {saving ? (
                <I18nText en="Submitting..." ko="제출 중..." />
              ) : (
                <I18nText en="Submit Registration" ko="가입 신청서 제출" />
              )}
            </button>
            {registration && editing ? (
              <button
                type="button"
                disabled={saving}
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
      {teamChatUnavailable ? <p role="alert" className="text-sm font-semibold text-red-700"><I18nText en="Your registration is saved, but the team chat is temporarily unavailable. Please try again later." ko="신청서는 저장되어 있습니다. 팀채팅 연결 정보를 불러올 수 없으니 잠시 후 다시 확인해 주세요." /></p> : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

function TextField({
  disabled = false,
  error,
  helper,
  label,
  onChange,
  placeholder,
  site = false,
  value
}: {
  disabled?: boolean;
  error?: string;
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  site?: boolean;
  value: string;
}) {
  return (
    <label className={site ? styles.field : "grid gap-2 text-sm font-semibold text-ink"}>
      <span>{label}</span>
      <input
        required
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className="form-field"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="text-xs font-semibold leading-5 text-red-700">{error}</span> : null}
      {helper ? <span className="text-xs font-normal leading-5 text-ink/54">{helper}</span> : null}
    </label>
  );
}
