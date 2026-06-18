"use client";

import { CheckCircle2, RefreshCcw, Search, ShieldCheck, ShieldPlus, UserCheck, UserMinus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import type { EccAccess, EccRole } from "@/lib/eccAccess";

type ManagedMember = {
  access: EccAccess;
  avatarUrl: string;
  createdAt: string;
  email: string;
  lastLoginAt: string;
  name: string;
  roleStatus: {
    adminStatus: string;
    officialMemberStatus: string;
    paymentConfirmed: boolean;
    superAdminStatus: string;
  };
  siteStatus: string;
};

type RolesResponse = {
  developerInfo: null | {
    developerEmails: string[];
    eccOfficialTeamChatUrl: string;
    superAdminEmails: string[];
  };
  error?: string;
  me: EccAccess;
  members: ManagedMember[];
  roleRequests: {
    admin: ManagedMember[];
    superAdmin: ManagedMember[];
  };
};

const roleLabels: Record<EccRole, { en: string; ko: string }> = {
  admin: { en: "Admin", ko: "관리자" },
  developer: { en: "Developer", ko: "개발자" },
  official_member: { en: "Official member", ko: "정식회원" },
  super_admin: { en: "Super admin", ko: "슈퍼관리자" },
  user: { en: "General user", ko: "일반회원" }
};

export function EccPermissionManagementPanel() {
  const { language } = useLanguage();
  const [data, setData] = useState<RolesResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ecc/roles");
      const nextData = (await response.json()) as RolesResponse;

      if (!response.ok) {
        throw new Error(nextData.error || "ECC role data could not be loaded.");
      }

      setData(nextData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "ECC role data could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateRole = async (action: string, email: string) => {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/ecc/roles", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action, email })
      });
      const nextData = (await response.json()) as RolesResponse;

      if (!response.ok) {
        throw new Error(nextData.error || "ECC role change could not be saved.");
      }

      setData(nextData);
      setMessage(language === "ko" ? "권한 변경이 저장되었습니다." : "Permission change saved.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "ECC role change could not be saved.");
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    const members = data?.members ?? [];
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return members;
    }

    return members.filter(
      (member) =>
        member.email.toLowerCase().includes(normalized) ||
        member.name.toLowerCase().includes(normalized)
    );
  }, [data?.members, query]);

  if (loading && !data) {
    return (
      <section className="paper-panel p-6 text-sm font-semibold text-ink/62">
        <I18nText en="Loading ECC permission system..." ko="ECC 권한 정보를 불러오는 중..." />
      </section>
    );
  }

  const me = data?.me;

  return (
    <section className="paper-panel grid gap-6 p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-brass">
            <I18nText en="Permission control" ko="권한 관리" />
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
            <I18nText en="ECC Permission System" ko="ECC 권한 시스템" />
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink/64">
            <I18nText
              en="Confirm official membership, approve admin requests, and manage ECC role hierarchy."
              ko="정식회원 승인, 관리자 요청 승인, ECC 권한 계층을 관리합니다."
            />
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex min-h-10 items-center gap-2 border border-ink/12 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
        >
          <RefreshCcw aria-hidden className="h-4 w-4" />
          <I18nText en="Refresh" ko="새로고침" />
        </button>
      </div>

      {message ? (
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-pine">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}

      {me ? (
        <div className="grid gap-3 border border-ink/10 bg-white/50 p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-semibold text-ink">
              <I18nText en="Current account" ko="현재 계정" />
            </p>
            <p className="mt-1 text-sm text-ink/62">{me.email}</p>
          </div>
          <span className="inline-flex min-h-9 items-center border border-brass/30 bg-brass/10 px-4 text-sm font-semibold text-ink">
            <I18nText en={roleLabels[me.role].en} ko={roleLabels[me.role].ko} />
          </span>
        </div>
      ) : null}

      {(data?.roleRequests.admin.length || data?.roleRequests.superAdmin.length) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.roleRequests.admin.length ? (
            <div className="border border-ink/10 bg-white/50 p-4">
              <h3 className="flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
                <ShieldCheck aria-hidden className="h-5 w-5 text-brass" />
                <I18nText en="Admin requests" ko="관리자 요청" />
              </h3>
              <div className="mt-4 grid gap-3">
                {data.roleRequests.admin.map((member) => (
                  <RoleRequestRow
                    key={`admin-${member.email}`}
                    member={member}
                    action="approve_admin"
                    disabled={loading || !me?.isSuperAdmin}
                    onApprove={updateRole}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {data.roleRequests.superAdmin.length && me?.isDeveloper ? (
            <div className="border border-ink/10 bg-white/50 p-4">
              <h3 className="flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
                <ShieldPlus aria-hidden className="h-5 w-5 text-brass" />
                <I18nText en="Super-admin requests" ko="슈퍼관리자 요청" />
              </h3>
              <div className="mt-4 grid gap-3">
                {data.roleRequests.superAdmin.map((member) => (
                  <RoleRequestRow
                    key={`super-${member.email}`}
                    member={member}
                    action="approve_super_admin"
                    disabled={loading}
                    onApprove={updateRole}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="grid gap-2 text-sm font-semibold text-ink">
        <span className="inline-flex items-center gap-2">
          <Search aria-hidden className="h-4 w-4" />
          <I18nText en="Search members" ko="회원 검색" />
        </span>
        <input
          className="form-field"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={language === "ko" ? "이름 또는 이메일" : "Name or email"}
        />
      </label>

      <div className="overflow-x-auto border border-ink/10">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="bg-white/70 text-xs uppercase text-ink/58">
            <tr>
              <th className="border-b border-ink/10 px-4 py-3">
                <I18nText en="Member" ko="회원" />
              </th>
              <th className="border-b border-ink/10 px-4 py-3">
                <I18nText en="Role" ko="권한" />
              </th>
              <th className="border-b border-ink/10 px-4 py-3">
                <I18nText en="Payment" ko="회비" />
              </th>
              <th className="border-b border-ink/10 px-4 py-3">
                <I18nText en="Actions" ko="작업" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member) => (
              <tr key={member.email} className="border-b border-ink/8 last:border-b-0">
                <td className="px-4 py-4">
                  <p className="font-semibold text-ink">{member.name || member.email}</p>
                  <p className="mt-1 text-xs text-ink/54">{member.email}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex min-h-8 items-center border border-ink/10 bg-paper px-3 text-xs font-semibold text-ink">
                    <I18nText
                      en={roleLabels[member.access.role].en}
                      ko={roleLabels[member.access.role].ko}
                    />
                  </span>
                </td>
                <td className="px-4 py-4 text-ink/66">
                  {member.roleStatus.paymentConfirmed ? (
                    <I18nText en="Confirmed" ko="납부 확인" />
                  ) : (
                    <I18nText en="Not confirmed" ko="미확인" />
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {member.access.isOfficialMember ? (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => updateRole("revoke_official_member", member.email)}
                        className="inline-flex min-h-9 items-center gap-2 border border-red-900/20 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <UserMinus aria-hidden className="h-3.5 w-3.5" />
                        <I18nText en="Revoke member" ko="정식회원 해제" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => updateRole("approve_official_member", member.email)}
                        className="inline-flex min-h-9 items-center gap-2 bg-ink px-3 text-xs font-semibold text-paper transition hover:bg-navy disabled:opacity-50"
                      >
                        <UserCheck aria-hidden className="h-3.5 w-3.5" />
                        <I18nText en="Approve member" ko="정식회원 승인" />
                      </button>
                    )}
                    {me?.isSuperAdmin && member.access.role === "admin" ? (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => updateRole("revoke_admin", member.email)}
                        className="inline-flex min-h-9 items-center gap-2 border border-red-900/20 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <I18nText en="Revoke admin" ko="관리자 해제" />
                      </button>
                    ) : null}
                    {me?.isDeveloper && member.access.role === "super_admin" ? (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => updateRole("revoke_super_admin", member.email)}
                        className="inline-flex min-h-9 items-center gap-2 border border-red-900/20 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <I18nText en="Revoke super" ko="슈퍼관리자 해제" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.developerInfo ? (
        <div className="border border-brass/25 bg-brass/10 p-4 text-sm leading-7 text-ink">
          <p className="font-semibold uppercase text-brass">
            <I18nText en="Developer-only role acquisition information" ko="개발자 전용 권한 계정 정보" />
          </p>
          <p className="mt-3">
            DEVELOPER_EMAILS: {data.developerInfo.developerEmails.join(", ") || "-"}
          </p>
          <p>SUPER_ADMIN_EMAILS: {data.developerInfo.superAdminEmails.join(", ") || "-"}</p>
          <p className="break-all">ECC_OFFICIAL_TEAM_CHAT_URL: {data.developerInfo.eccOfficialTeamChatUrl}</p>
        </div>
      ) : null}
    </section>
  );
}

function RoleRequestRow({
  action,
  disabled,
  member,
  onApprove
}: {
  action: string;
  disabled: boolean;
  member: ManagedMember;
  onApprove: (action: string, email: string) => void;
}) {
  return (
    <div className="grid gap-3 border border-ink/10 bg-paper/60 p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="font-semibold text-ink">{member.name || member.email}</p>
        <p className="mt-1 text-xs text-ink/54">{member.email}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onApprove(action, member.email)}
        className="inline-flex min-h-9 items-center justify-center gap-2 bg-ink px-4 text-xs font-semibold text-paper transition hover:bg-navy disabled:opacity-50"
      >
        <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
        <I18nText en="Approve" ko="승인" />
      </button>
    </div>
  );
}
