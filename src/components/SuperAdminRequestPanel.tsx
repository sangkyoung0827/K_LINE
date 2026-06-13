"use client";

import Link from "next/link";
import {
  CheckCircle2,
  LockKeyhole,
  RefreshCcw,
  Send,
  ShieldCheck,
  ShieldPlus,
  Trash2,
  UserPlus
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type RoleName = "member" | "super_admin" | "developer";

type RoleRequest = {
  id: string;
  createdAt: string;
  email: string;
  name: string;
  reason: string;
  requestedRole: string;
  status: string;
  reviewedBy: string;
  reviewedAt: string;
};

type AdminMember = {
  id: string;
  createdAt: string;
  email: string;
  role: string;
  status: string;
  grantedBy: string;
  revokedBy: string;
  revokedAt: string;
  source: "database" | "environment" | "developer";
};

type RoleResponse = {
  admins: AdminMember[];
  error?: string;
  me: {
    email: string;
    isDeveloper: boolean;
    isLoggedIn: boolean;
    isSuperAdmin: boolean;
    role: RoleName;
  };
  requests: RoleRequest[];
};

const emptyResponse: RoleResponse = {
  admins: [],
  me: {
    email: "",
    isDeveloper: false,
    isLoggedIn: false,
    isSuperAdmin: false,
    role: "member"
  },
  requests: []
};

function formatDate(value: string, language: "en" | "ko") {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusLabel(status: string, language: "en" | "ko") {
  if (language === "ko") {
    if (status === "approved") {
      return "승인됨";
    }
    if (status === "rejected") {
      return "거절됨";
    }
    return "대기 중";
  }

  if (status === "approved") {
    return "Approved";
  }
  if (status === "rejected") {
    return "Rejected";
  }
  return "Pending";
}

export function SuperAdminRequestPanel() {
  const { language } = useLanguage();
  const [data, setData] = useState<RoleResponse>(emptyResponse);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [directEmail, setDirectEmail] = useState("");

  const text = useMemo(
    () =>
      language === "ko"
        ? {
            activeAdmins: "현재 권한 계정",
            approve: "승인",
            approveHelp: "슈퍼관리자는 대기 중인 요청을 승인할 수 있습니다.",
            developerOnly: "개발자 전용",
            directEmail: "등록할 이메일",
            emptyAdmins: "아직 표시할 슈퍼관리자 계정이 없습니다.",
            emptyRequests: "대기 중인 요청이 없습니다.",
            grantedBy: "등록자",
            grantSuperAdmin: "슈퍼관리자 직접 등록",
            loading: "권한 정보를 불러오는 중입니다.",
            login: "로그인하러 가기",
            loginRequired:
              "슈퍼관리자 권한을 요청하려면 먼저 Google 계정으로 로그인해야 합니다.",
            name: "이름",
            panelDescription:
              "신규 임원은 이곳에서 슈퍼관리자 권한을 요청할 수 있습니다. 승인된 슈퍼관리자는 다른 요청을 승인 할 수 있습니다.",
            panelEyebrow: "Role request",
            panelTitle: "슈퍼관리자 권한 요청",
            reason: "요청 사유",
            refresh: "새로고침",
            request: "권한 요청하기",
            requestSent: "슈퍼관리자 권한 요청이 접수되었습니다.",
            revoke: "삭제",
            roleDeveloper: "개발자",
            roleMember: "일반회원",
            roleSuperAdmin: "슈퍼관리자",
            saved: "권한 변경이 저장되었습니다.",
            status: "요청 상태",
            submitHelp:
              "권한은 현재 로그인한 이메일 기준으로 요청됩니다. 승인 전까지는 일반회원 권한으로 유지됩니다.",
            tableMissing:
              "권한 저장 테이블이 아직 준비되지 않았습니다. Supabase에서 admin_roles와 admin_role_requests 테이블을 생성해야 합니다.",
            yourAccount: "현재 계정"
          }
        : {
            activeAdmins: "Current role accounts",
            approve: "Approve",
            approveHelp: "Super admins can approve pending requests.",
            developerOnly: "Developer only",
            directEmail: "Email to register",
            emptyAdmins: "No super-admin accounts to show yet.",
            emptyRequests: "No pending requests.",
            grantedBy: "Granted by",
            grantSuperAdmin: "Register Super Admin",
            loading: "Loading role information.",
            login: "Go to login",
            loginRequired:
              "Please log in with Google before requesting super-admin access.",
            name: "Name",
            panelDescription:
              "New officers can request super-admin access here. Approved super admins can approve future requests.",
            panelEyebrow: "Role request",
            panelTitle: "Super-admin Access Request",
            reason: "Reason",
            refresh: "Refresh",
            request: "Request Access",
            requestSent: "Super-admin access request was submitted.",
            revoke: "Remove",
            roleDeveloper: "Developer",
            roleMember: "Member",
            roleSuperAdmin: "Super Admin",
            saved: "Role change saved.",
            status: "Request status",
            submitHelp:
              "The request uses your currently logged-in email. Until approval, your role stays as member.",
            tableMissing:
              "Role storage tables are not ready yet. Create admin_roles and admin_role_requests in Supabase.",
            yourAccount: "Current account"
          },
    [language]
  );

  const pendingRequests = data.requests.filter((request) => request.status === "pending");
  const ownLatestRequest = data.requests[0];

  const roleLabel =
    data.me.role === "developer"
      ? text.roleDeveloper
      : data.me.role === "super_admin"
        ? text.roleSuperAdmin
        : text.roleMember;

  const loadRoles = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/roles");
      const nextData = (await response.json()) as RoleResponse;

      if (!response.ok) {
        throw new Error(nextData.error || text.tableMissing);
      }

      setData(nextData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : text.tableMissing);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, reason })
      });
      const nextData = (await response.json()) as RoleResponse;

      if (!response.ok) {
        throw new Error(nextData.error || text.tableMissing);
      }

      setData(nextData);
      setMessage(text.requestSent);
      setReason("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : text.tableMissing);
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (body: Record<string, string>) => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const nextData = (await response.json()) as RoleResponse;

      if (!response.ok) {
        throw new Error(nextData.error || text.tableMissing);
      }

      setData(nextData);
      setMessage(text.saved);
      setDirectEmail("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : text.tableMissing);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="paper-panel mt-10 grid gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex h-12 w-12 items-center justify-center bg-navy text-paper">
            <ShieldPlus aria-hidden className="h-5 w-5" />
          </div>
          <p className="mt-5 text-sm font-semibold uppercase text-brass">{text.panelEyebrow}</p>
          <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">{text.panelTitle}</h2>
          <p className="mt-4 text-sm leading-7 text-ink/64">{text.panelDescription}</p>
        </div>
        <button
          type="button"
          onClick={loadRoles}
          className="inline-flex min-h-10 items-center justify-center gap-2 border border-ink/12 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
        >
          <RefreshCcw aria-hidden className="h-4 w-4" />
          {text.refresh}
        </button>
      </div>

      <div className="grid gap-4 border border-ink/10 bg-white/45 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-sm font-semibold text-ink">{text.yourAccount}</p>
          <p className="mt-1 text-sm text-ink/62">
            {data.me.isLoggedIn ? data.me.email : text.loginRequired}
          </p>
        </div>
        <span className="inline-flex min-h-9 items-center justify-center border border-brass/35 bg-brass/10 px-4 text-sm font-semibold text-ink">
          {roleLabel}
        </span>
      </div>

      {loading ? <p className="text-sm text-ink/62">{text.loading}</p> : null}
      {message ? (
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-pine">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}

      {!data.me.isLoggedIn ? (
        <div className="grid gap-4 border border-ink/10 bg-white/55 p-5">
          <div className="flex items-center gap-3">
            <LockKeyhole aria-hidden className="h-5 w-5 text-brass" />
            <p className="text-sm leading-7 text-ink/64">{text.loginRequired}</p>
          </div>
          <Link
            href="/login"
            className="inline-flex min-h-11 w-fit items-center justify-center bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
          >
            {text.login}
          </Link>
        </div>
      ) : data.me.isSuperAdmin ? (
        <div className={`grid gap-6 ${data.me.isDeveloper ? "lg:grid-cols-[1.1fr_0.9fr]" : ""}`}>
          <div className="border border-ink/10 bg-white/55 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck aria-hidden className="mt-1 h-5 w-5 text-brass" />
              <div>
                <h3 className="font-serif text-3xl font-semibold text-ink">{text.panelTitle}</h3>
                <p className="mt-2 text-sm leading-7 text-ink/62">{text.approveHelp}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {pendingRequests.length > 0 ? (
                pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="grid gap-3 border border-ink/10 bg-paper/55 p-4 md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div>
                      <p className="font-semibold text-ink">{request.name || request.email}</p>
                      <p className="mt-1 text-sm text-ink/58">{request.email}</p>
                      {request.reason ? (
                        <p className="mt-2 text-sm leading-7 text-ink/64">{request.reason}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-ink/48">
                        {formatDate(request.createdAt, language)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => updateRole({ action: "approve", requestId: request.id })}
                      className="inline-flex min-h-10 items-center justify-center gap-2 bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-navy disabled:opacity-50"
                    >
                      <CheckCircle2 aria-hidden className="h-4 w-4" />
                      {text.approve}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink/62">{text.emptyRequests}</p>
              )}
            </div>
          </div>

          {data.me.isDeveloper ? (
            <div className="border border-ink/10 bg-white/55 p-5">
              <h3 className="font-serif text-3xl font-semibold text-ink">{text.activeAdmins}</h3>
              <div className="mt-5 grid gap-3">
                {data.admins.length > 0 ? (
                  data.admins.map((admin) => (
                    <div key={admin.id} className="border border-ink/10 bg-paper/55 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{admin.email}</p>
                          <p className="mt-1 text-xs uppercase text-ink/48">
                            {admin.role === "developer" ? text.roleDeveloper : text.roleSuperAdmin}
                          </p>
                        </div>
                        {admin.source !== "developer" ? (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => updateRole({ action: "revoke", email: admin.email })}
                            className="inline-flex min-h-9 items-center justify-center gap-2 border border-red-900/20 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 aria-hidden className="h-3.5 w-3.5" />
                            {text.revoke}
                          </button>
                        ) : null}
                      </div>
                      {admin.grantedBy ? (
                        <p className="mt-3 text-xs text-ink/48">
                          {text.grantedBy}: {admin.grantedBy}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink/62">{text.emptyAdmins}</p>
                )}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void updateRole({ action: "grant", email: directEmail });
                }}
                className="mt-6 grid gap-3 border-t border-ink/10 pt-5"
              >
                <p className="text-sm font-semibold uppercase text-brass">{text.developerOnly}</p>
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  {text.directEmail}
                  <input
                    required
                    type="email"
                    className="form-field"
                    value={directEmail}
                    onChange={(event) => setDirectEmail(event.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy disabled:opacity-50"
                >
                  <UserPlus aria-hidden className="h-4 w-4" />
                  {text.grantSuperAdmin}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : (
        <form onSubmit={submitRequest} className="grid gap-4 border border-ink/10 bg-white/55 p-5">
          <p className="text-sm leading-7 text-ink/62">{text.submitHelp}</p>
          {ownLatestRequest ? (
            <div className="border border-brass/25 bg-brass/10 p-4">
              <p className="text-sm font-semibold text-ink">{text.status}</p>
              <p className="mt-1 text-sm text-ink/64">
                {statusLabel(ownLatestRequest.status, language)} /{" "}
                {formatDate(ownLatestRequest.createdAt, language)}
              </p>
            </div>
          ) : null}
          <label className="grid gap-2 text-sm font-semibold text-ink">
            {text.name}
            <input
              className="form-field"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            {text.reason}
            <textarea
              className="form-field min-h-28"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy disabled:opacity-50"
          >
            <Send aria-hidden className="h-4 w-4" />
            {text.request}
          </button>
        </form>
      )}
    </section>
  );
}
