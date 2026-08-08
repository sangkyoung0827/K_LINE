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
    <div className="grid justify-items-center gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={submit}
        className="inline-flex min-h-9 w-fit items-center gap-2 text-xs font-semibold text-ink/48 transition hover:text-ink disabled:opacity-50"
      >
        <ShieldPlus aria-hidden className="h-3.5 w-3.5" />
        {action === "request_admin" ? (
          <I18nText en="Request admin permission" ko="관리자 권한 요청" />
        ) : (
          <I18nText en="Request super-admin permission" ko="슈퍼관리자 권한 요청" />
        )}
        <Send aria-hidden className="h-3.5 w-3.5" />
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
