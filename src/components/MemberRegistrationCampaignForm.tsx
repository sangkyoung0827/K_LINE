"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CTAButton } from "@/components/CTAButton";

type CampaignForm = {
  title: string;
  description: string;
  targetGroup: string;
  googleFormUrl: string;
  googleSheetUrl: string;
  googleSheetId: string;
  sheetTabName: string;
  startDate: string;
  deadline: string;
  isActive: boolean;
  publicNote: string;
};

const initialForm: CampaignForm = {
  title: "",
  description: "",
  targetGroup: "ECC",
  googleFormUrl: "",
  googleSheetUrl: "",
  googleSheetId: "",
  sheetTabName: "",
  startDate: "",
  deadline: "",
  isActive: true,
  publicNote: ""
};

export function MemberRegistrationCampaignForm() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const update = <Key extends keyof CampaignForm>(field: Key, value: CampaignForm[Key]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/member-registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as { campaign?: { id: string }; error?: string };

      if (!response.ok || !data.campaign) {
        throw new Error(data.error || "Member registration campaign could not be created.");
      }

      router.push(`/admin/member-registrations/${data.campaign.id}`);
      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Member registration campaign could not be created."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-5 p-5 md:p-8">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Campaign title
          <input
            required
            className="form-field"
            placeholder="ECC 2026 Spring New Members"
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Target group
          <input
            className="form-field"
            placeholder="ECC"
            value={form.targetGroup}
            onChange={(event) => update("targetGroup", event.target.value)}
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-ink">
        Official Google Form URL after membership fee payment
        <input
          required
          type="url"
          className="form-field"
            placeholder="https://docs.google.com/forms/... (official member form)"
          value={form.googleFormUrl}
          onChange={(event) => update("googleFormUrl", event.target.value)}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-ink md:col-span-2">
          Google Sheets URL
          <input
            type="url"
            className="form-field"
            placeholder="Optional response sheet URL"
            value={form.googleSheetUrl}
            onChange={(event) => update("googleSheetUrl", event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Sheet tab
          <input
            className="form-field"
            placeholder="Form Responses 1"
            value={form.sheetTabName}
            onChange={(event) => update("sheetTabName", event.target.value)}
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-ink">
        Google Sheet ID
        <input
          className="form-field"
          placeholder="Optional, for future Google Sheets API connection"
          value={form.googleSheetId}
          onChange={(event) => update("googleSheetId", event.target.value)}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Start date
          <input
            type="date"
            className="form-field"
            value={form.startDate}
            onChange={(event) => update("startDate", event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Deadline
          <input
            type="date"
            className="form-field"
            value={form.deadline}
            onChange={(event) => update("deadline", event.target.value)}
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-ink">
        Description
        <textarea
          className="form-field min-h-28"
          placeholder="Internal campaign description"
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-ink">
        Public Open Chat note
        <textarea
          className="form-field min-h-28"
          placeholder="Shown on the public registration guide page before the official Google Form"
          value={form.publicNote}
          onChange={(event) => update("publicNote", event.target.value)}
        />
      </label>

      <label className="inline-flex items-center gap-3 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(event) => update("isActive", event.target.checked)}
          className="h-4 w-4 accent-navy"
        />
        Active public registration page
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <CTAButton type="submit" disabled={saving}>
          {saving ? "Creating..." : "Create Campaign"}
        </CTAButton>
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
    </form>
  );
}
