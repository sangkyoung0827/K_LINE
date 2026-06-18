"use client";

import { CheckCircle2, Send, ShieldPlus } from "lucide-react";
import { useState } from "react";
import { I18nText } from "@/components/LanguageProvider";
import type { EccRole } from "@/lib/eccAccess";

export function EccPermissionRequestCard({ role }: { role: EccRole }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const action =
    role === "official_member" ? "request_admin" : role === "admin" ? "request_super_admin" : "";

  if (!action) {
    return null;
  }

  const submit = async () => {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/ecc/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Permission request could not be submitted.");
      }

      setMessage(
        action === "request_admin"
          ? "Admin permission request submitted."
          : "Super-admin permission request submitted."
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Permission request could not be submitted."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="paper-panel grid gap-4 p-5 md:p-6">
      <div className="flex h-11 w-11 items-center justify-center bg-navy text-paper">
        <ShieldPlus aria-hidden className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold uppercase text-brass">
          <I18nText en="Permission request" ko="권한 요청" />
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">
          {action === "request_admin" ? (
            <I18nText en="Apply for Admin Permission" ko="관리자 권한 요청" />
          ) : (
            <I18nText en="Apply for Super Admin Permission" ko="슈퍼관리자 권한 요청" />
          )}
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink/64">
          {action === "request_admin" ? (
            <I18nText
              en="Official members can request admin permission after joining ECC operations."
              ko="정식회원은 ECC 운영 참여를 위해 관리자 권한을 요청할 수 있습니다."
            />
          ) : (
            <I18nText
              en="Admins can request super-admin permission. Approval is handled by the developer."
              ko="관리자는 슈퍼관리자 권한을 요청할 수 있으며, 승인은 개발자가 처리합니다."
            />
          )}
        </p>
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={submit}
        className="inline-flex min-h-11 w-fit items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy disabled:opacity-50"
      >
        <Send aria-hidden className="h-4 w-4" />
        <I18nText en="Submit Request" ko="요청하기" />
      </button>
      {message ? (
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-pine">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
