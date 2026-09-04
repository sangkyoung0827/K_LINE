"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Save, Search, Trash2, UserCheck } from "lucide-react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

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
  paymentConfirmedBy: string;
  paymentConfirmedAt: string;
  officialMember: boolean;
  officialMemberApprovedBy: string;
  officialMemberApprovedAt: string;
  status: RegistrationStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
};

type DraftState = Record<
  string,
  {
    adminNote: string;
    paymentConfirmed: boolean;
  }
>;

type RegistrationListResponse = {
  access?: {
    email?: string;
    isDeveloper?: boolean;
  };
  reset?: {
    email?: string;
  };
  error?: string;
  registrations?: EccMemberRegistration[];
  updatedCount?: number;
};

function formatDate(value: string, language: "en" | "ko") {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString(language === "ko" ? "ko-KR" : "en-US");
}

function statusLabel(registration: EccMemberRegistration, language: "en" | "ko") {
  if (registration.officialMember || registration.status === "approved") {
    return language === "ko" ? "정식회원 승인" : "Official member";
  }

  if (registration.status === "rejected") {
    return language === "ko" ? "재확인 필요" : "Needs review";
  }

  return language === "ko" ? "회비 확인 대기" : "Payment pending";
}

function toDrafts(nextRegistrations: EccMemberRegistration[]) {
  return Object.fromEntries(
    nextRegistrations.map((registration) => [
      registration.id,
      {
        adminNote: registration.adminNote,
        paymentConfirmed: registration.paymentConfirmed
      }
    ])
  );
}

export function EccMemberRegistrationManagementPanel() {
  const { language } = useLanguage();
  const [registrations, setRegistrations] = useState<EccMemberRegistration[]>([]);
  const [drafts, setDrafts] = useState<DraftState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [developerEmail, setDeveloperEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [memberQuery, setMemberQuery] = useState("");

  const applyRegistrations = (nextRegistrations: EccMemberRegistration[]) => {
    setRegistrations(nextRegistrations);
    setDrafts(toDrafts(nextRegistrations));
  };

  useEffect(() => {
    let active = true;

    fetch("/api/ecc/member-registrations")
      .then((response) =>
        response.json().then((data: RegistrationListResponse) => ({
          data,
          response
        }))
      )
      .then(({ data, response }) => {
        if (!active) {
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "ECC member registrations could not be loaded.");
        }

        applyRegistrations(data.registrations ?? []);
        setIsDeveloper(Boolean(data.access?.isDeveloper));
        setDeveloperEmail(data.access?.email ?? "");
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "ECC member registrations could not be loaded."
        );
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

  const summary = useMemo(
    () => ({
      approved: registrations.filter((registration) => registration.officialMember).length,
      pending: registrations.filter((registration) => !registration.officialMember).length,
      total: registrations.length
    }),
    [registrations]
  );

  const filteredRegistrations = useMemo(() => {
    const normalizedQuery = memberQuery
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (!normalizedQuery) {
      return registrations;
    }

    const queryTokens = normalizedQuery.split(" ").filter(Boolean);
    const genderAliases: Record<string, string> = {
      Male: "male man 남성 남자",
      Female: "female woman 여성 여자",
      Etc: "etc other 기타",
      "Prefer not to say": "prefer not to say private 비공개 밝히고 싶지 않음"
    };

    return registrations.filter((registration) => {
      const searchableText = [
        registration.fullName,
        registration.googleName,
        registration.googleEmail,
        registration.studentId,
        registration.departmentOrMajor,
        registration.nationality,
        registration.gender,
        genderAliases[registration.gender] ?? "",
        registration.kakaoDisplayName,
        registration.kakaoId
      ]
        .join(" ")
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/\s+/g, " ");

      return queryTokens.every((token) => searchableText.includes(token));
    });
  }, [memberQuery, registrations]);

  const updateDraft = (id: string, value: Partial<DraftState[string]>) => {
    setDrafts((current) => {
      const existing = current[id] ?? {
        adminNote: "",
        paymentConfirmed: false
      };

      return {
        ...current,
        [id]: {
          ...existing,
          ...value
        }
      };
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/ecc/member-registrations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          registrations: registrations.map((registration) => ({
            adminNote: drafts[registration.id]?.adminNote ?? "",
            id: registration.id,
            paymentConfirmed: Boolean(drafts[registration.id]?.paymentConfirmed)
          }))
        })
      });
      const data = (await response.json()) as RegistrationListResponse;

      if (!response.ok) {
        throw new Error(data.error || "ECC member registrations could not be saved.");
      }

      applyRegistrations(data.registrations ?? []);
      setMessage(
        language === "ko"
          ? `신규회원 등록 ${data.updatedCount ?? 0}건을 저장했습니다.`
          : `${data.updatedCount ?? 0} ECC member registration records saved.`
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ECC member registrations could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRegistration = async (registration: EccMemberRegistration) => {
    const confirmed = window.confirm(
      language === "ko"
        ? `${registration.fullName || registration.googleEmail}님의 ECC 가입 신청과 ECC 자체 권한을 초기화하시겠습니까? 사이트 계정과 다른 K_LINE 데이터는 유지됩니다.`
        : `Reset ${registration.fullName || registration.googleEmail}'s ECC registration and ECC-specific permission data? Their site account and other K_LINE data will remain.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(registration.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/ecc/member-registrations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id: registration.id })
      });
      const data = (await response.json()) as RegistrationListResponse;

      if (!response.ok) {
        throw new Error(data.error || "ECC member registration could not be reset.");
      }

      applyRegistrations(data.registrations ?? []);
      setMessage(
        language === "ko"
          ? "ECC 가입 신청과 ECC 자체 권한을 초기화했습니다."
          : "The ECC registration and ECC-specific permission data were reset."
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "ECC member registration could not be reset."
      );
    } finally {
      setDeletingId("");
    }
  };

  if (loading) {
    return (
      <div className="paper-panel flex items-center gap-3 p-6 text-sm font-semibold text-ink/62">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        <I18nText en="Loading ECC new member registrations..." ko="ECC 신규회원 등록을 불러오는 중..." />
      </div>
    );
  }

  return (
    <section className="paper-panel overflow-hidden">
      <div className="border-b border-ink/10 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-ink">
              <I18nText en="ECC New Member Approval" ko="ECC 신규회원 승인" />
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/68">
              <I18nText
                en="Check membership fee payment, save, and the selected Google account becomes an official ECC member with access to ECC OFFICIAL."
                ko="회비 납부 여부를 체크하고 저장하면 해당 Google 계정이 ECC 정식회원으로 승인되어 ECC OFFICIAL 접근 권한을 얻습니다."
              />
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="border border-ink/10 bg-white/45 p-3">
                <p className="font-serif text-2xl font-semibold text-ink">{summary.total}</p>
                <p className="mt-1 text-xs font-semibold uppercase text-ink/48">
                  <I18nText en="Total" ko="전체" />
                </p>
              </div>
              <div className="border border-pine/20 bg-pine/10 p-3">
                <p className="font-serif text-2xl font-semibold text-pine">{summary.approved}</p>
                <p className="mt-1 text-xs font-semibold uppercase text-ink/48">
                  <I18nText en="Approved" ko="승인" />
                </p>
              </div>
              <div className="border border-brass/20 bg-brass/10 p-3">
                <p className="font-serif text-2xl font-semibold text-ink">{summary.pending}</p>
                <p className="mt-1 text-xs font-semibold uppercase text-ink/48">
                  <I18nText en="Pending" ko="대기" />
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving || Boolean(deletingId) || registrations.length === 0}
              className="inline-flex min-h-12 items-center gap-2 bg-ink px-6 text-sm font-semibold text-paper transition hover:bg-navy disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Save aria-hidden className="h-4 w-4" />}
              {saving ? <I18nText en="Saving..." ko="저장 중..." /> : <I18nText en="Save" ko="저장" />}
            </button>
          </div>
        </div>
      </div>

      {registrations.length > 0 ? (
        <div className="divide-y divide-ink/10">
          <div className="border-b border-ink/10 p-5 md:p-6">
            <label className="flex max-w-md items-center gap-3 border border-ink/15 bg-white/55 px-4 text-ink transition focus-within:border-navy/45 focus-within:ring-2 focus-within:ring-navy/10">
              <span className="sr-only">
                <I18nText en="Search by any registration information" ko="신청 정보 전체 검색" />
              </span>
              <Search
                aria-hidden
                className="h-4 w-4 shrink-0 text-ink/45"
              />
              <input
                type="text"
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                placeholder={
                  language === "ko"
                    ? "이름·학번·학과·국적·성별·카카오 정보 검색"
                    : "Search name, ID, major, nationality, gender, Kakao..."
                }
                className="min-h-11 w-full bg-transparent py-2 text-sm font-medium text-ink outline-none placeholder:text-ink/42"
              />
            </label>
          </div>
          {filteredRegistrations.map((registration) => {
            const draft = drafts[registration.id] ?? {
              adminNote: registration.adminNote,
              paymentConfirmed: registration.paymentConfirmed
            };

            return (
              <article key={registration.id} className="grid gap-5 p-5 md:p-6 xl:grid-cols-[auto_1fr_320px]">
                <label className="flex items-start gap-3 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={draft.paymentConfirmed}
                    onChange={(event) =>
                      updateDraft(registration.id, { paymentConfirmed: event.target.checked })
                    }
                    className="mt-1 h-5 w-5 accent-navy"
                  />
                  <span>
                    <I18nText en="Payment Confirmed" ko="회비 납부 확인" />
                  </span>
                </label>

                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {registration.googleAvatarUrl ? (
                      <img
                        src={registration.googleAvatarUrl}
                        alt=""
                        className="h-12 w-12 rounded-full border border-ink/10 object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-paper">
                        <UserCheck aria-hidden className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-ink">{registration.fullName}</h3>
                      <p className="text-xs leading-5 text-ink/56">
                        {registration.googleName || registration.googleEmail} / {registration.googleEmail}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 border px-2 py-1 text-xs font-semibold ${
                        registration.officialMember || draft.paymentConfirmed
                          ? "border-pine/20 bg-pine/10 text-pine"
                          : "border-brass/25 bg-brass/10 text-ink"
                      }`}
                    >
                      {registration.officialMember || draft.paymentConfirmed ? (
                        <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                      ) : null}
                      {statusLabel(registration, language)}
                    </span>
                  </div>

                  <dl className="grid gap-3 text-sm md:grid-cols-2">
                    {[
                      ["Student ID / 학번", registration.studentId],
                      ["Department or Major / 학과 또는 전공", registration.departmentOrMajor],
                      ["Nationality / 국적", registration.nationality],
                      ["Gender / 성별", registration.gender],
                      ["KakaoTalk Display Name / 카카오톡 표시 이름", registration.kakaoDisplayName],
                      ["Kakao ID / 카카오톡 ID", registration.kakaoId]
                    ].map(([label, value]) => (
                      <div key={label} className="border border-ink/10 bg-white/45 p-3">
                        <dt className="text-xs font-semibold uppercase text-ink/45">{label}</dt>
                        <dd className="mt-1 font-semibold text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="grid content-start gap-3">
                  <div className="border border-ink/10 bg-white/45 p-3 text-xs leading-6 text-ink/56">
                    <p>
                      <strong className="text-ink">
                        <I18nText en="Submitted" ko="제출" />:
                      </strong>{" "}
                      {formatDate(registration.createdAt, language)}
                    </p>
                    {registration.paymentConfirmedAt ? (
                      <p>
                        <strong className="text-ink">
                          <I18nText en="Approved" ko="승인" />:
                        </strong>{" "}
                        {formatDate(registration.paymentConfirmedAt, language)}
                      </p>
                    ) : null}
                    {registration.paymentConfirmedBy ? (
                      <p>
                        <strong className="text-ink">
                          <I18nText en="By" ko="처리자" />:
                        </strong>{" "}
                        {registration.paymentConfirmedBy}
                      </p>
                    ) : null}
                  </div>
                  <textarea
                    className="form-field min-h-28"
                    placeholder={language === "ko" ? "관리자 메모" : "Admin note"}
                    value={draft.adminNote}
                    onChange={(event) => updateDraft(registration.id, { adminNote: event.target.value })}
                  />
                  {isDeveloper && registration.googleEmail !== developerEmail ? (
                    <button
                      type="button"
                      onClick={() => void deleteRegistration(registration)}
                      disabled={saving || Boolean(deletingId)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 border border-red-900/25 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === registration.id ? (
                        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 aria-hidden className="h-4 w-4" />
                      )}
                      <I18nText en="Delete application" ko="신청 삭제" />
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
          {filteredRegistrations.length === 0 ? (
            <div className="p-8 text-sm leading-7 text-ink/62">
              <I18nText en="No member matches the registration information you searched." ko="검색한 신청 정보와 일치하는 회원이 없습니다." />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="p-8 text-sm leading-7 text-ink/62">
          <I18nText
            en="No ECC member registrations have been submitted yet."
            ko="아직 ECC 신규회원 등록이 없습니다."
          />
        </div>
      )}

      {message || error ? (
        <div className="flex flex-wrap items-center gap-4 border-t border-ink/10 p-5 md:p-6">
          {message ? <p className="text-sm font-semibold text-pine">{message}</p> : null}
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
