"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, ExternalLink, RefreshCcw, Save } from "lucide-react";
import { CTAButton } from "@/components/CTAButton";

type Campaign = {
  id: string;
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
  publicUrl: string;
};

type Applicant = {
  id: string;
  createdAt: string;
  externalRowId: string;
  applicantName: string;
  applicantEmail: string;
  status: string;
  kakaoJoined: boolean;
  memo: string;
};

type ApplicantDraft = Record<string, Pick<Applicant, "kakaoJoined" | "memo" | "status">>;

const statusOptions = ["pending", "approved", "paid", "invited", "waitlist", "rejected"];

export function MemberRegistrationCampaignDetail({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [campaignDraft, setCampaignDraft] = useState<Campaign | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [applicantDrafts, setApplicantDrafts] = useState<ApplicantDraft>({});
  const [csvText, setCsvText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch(`/api/member-registrations/${campaignId}`)
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(
        ({
          response,
          data
        }: {
          response: Response;
          data: { applicants?: Applicant[]; campaign?: Campaign; error?: string };
        }) => {
          if (!active) {
            return;
          }

          if (!response.ok || !data.campaign) {
            throw new Error(data.error || "Member registration campaign could not be loaded.");
          }

          setCampaign(data.campaign);
          setCampaignDraft(data.campaign);
          replaceApplicants(data.applicants ?? []);
        }
      )
      .catch((loadError) => {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Campaign could not be loaded.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [campaignId]);

  const filteredApplicants = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return applicants;
    }

    return applicants.filter((applicant) =>
      [applicant.applicantName, applicant.applicantEmail, applicant.status, applicant.memo]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [applicants, search]);

  const updateCampaign = <Key extends keyof Campaign>(field: Key, value: Campaign[Key]) => {
    setCampaignDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const updateApplicant = (applicantId: string, value: Partial<ApplicantDraft[string]>) => {
    setApplicantDrafts((current) => {
      const existing = current[applicantId] ?? {
        kakaoJoined: false,
        memo: "",
        status: "pending"
      };

      return {
        ...current,
        [applicantId]: {
          ...existing,
          ...value
        }
      };
    });
  };

  const copyPublicLink = async () => {
    if (!campaign?.publicUrl) {
      return;
    }
    await navigator.clipboard.writeText(campaign.publicUrl);
    setMessage("Public registration link copied.");
  };

  const saveCampaign = async () => {
    if (!campaignDraft) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/member-registrations/${campaignId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(campaignDraft)
      });
      const data = (await response.json()) as {
        applicants?: Applicant[];
        campaign?: Campaign;
        error?: string;
      };

      if (!response.ok || !data.campaign) {
        throw new Error(data.error || "Campaign changes could not be saved.");
      }

      setCampaign(data.campaign);
      setCampaignDraft(data.campaign);
      replaceApplicants(data.applicants ?? []);
      setMessage("Campaign settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Campaign changes could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const saveApplicants = async () => {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/member-registrations/${campaignId}/applicants`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          applicants: applicants.map((applicant) => ({
            id: applicant.id,
            ...applicantDrafts[applicant.id]
          }))
        })
      });
      const data = (await response.json()) as { applicants?: Applicant[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Applicant changes could not be saved.");
      }

      replaceApplicants(data.applicants ?? []);
      setMessage("Applicant statuses saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Applicant changes could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const importCsv = async () => {
    setImporting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/member-registrations/${campaignId}/csv-import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ csvText })
      });
      const data = (await response.json()) as {
        applicants?: Applicant[];
        error?: string;
        importedCount?: number;
        skippedCount?: number;
      };

      if (!response.ok) {
        throw new Error(data.error || "CSV could not be imported.");
      }

      replaceApplicants(data.applicants ?? []);
      setCsvText("");
      setMessage(
        `CSV imported. New applicants: ${data.importedCount ?? 0}, skipped existing rows: ${
          data.skippedCount ?? 0
        }.`
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "CSV could not be imported.");
    } finally {
      setImporting(false);
    }
  };

  const replaceApplicants = (nextApplicants: Applicant[]) => {
    setApplicants(nextApplicants);
    setApplicantDrafts(
      Object.fromEntries(
        nextApplicants.map((applicant) => [
          applicant.id,
          {
            kakaoJoined: applicant.kakaoJoined,
            memo: applicant.memo,
            status: applicant.status
          }
        ])
      )
    );
  };

  if (loading) {
    return <div className="paper-panel p-6 text-sm font-semibold text-ink/62">Loading campaign...</div>;
  }

  if (!campaign || !campaignDraft) {
    return <div className="paper-panel p-6 text-sm font-semibold text-red-700">{error || "Not found."}</div>;
  }

  return (
    <div className="grid gap-8">
      <section className="paper-panel grid gap-6 p-5 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">Public registration link</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold text-ink">{campaign.title}</h2>
            <p className="mt-3 break-all text-sm leading-7 text-ink/62">{campaign.publicUrl}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyPublicLink}
                className="inline-flex min-h-11 items-center gap-2 border border-navy/20 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
              >
                <Copy aria-hidden className="h-4 w-4" />
                Copy link
              </button>
              <a
                href={campaign.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 border border-navy/20 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
              >
                <ExternalLink aria-hidden className="h-4 w-4" />
                Open public page
              </a>
              <a
                href={`/api/member-registrations/${campaign.id}/qr`}
                download
                className="inline-flex min-h-11 items-center gap-2 bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-navy"
              >
                <Download aria-hidden className="h-4 w-4" />
                Download Open Chat QR
              </a>
            </div>
          </div>
          <img
            src={`/api/member-registrations/${campaign.id}/qr`}
            alt="ECC KakaoTalk Open Chat QR code"
            className="aspect-square w-full border border-ink/10 bg-white object-contain p-3"
          />
        </div>
      </section>

      <section className="paper-panel grid gap-5 p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">Campaign settings</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">
              Official Google Form campaign
            </h2>
          </div>
          <label className="inline-flex items-center gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={campaignDraft.isActive}
              onChange={(event) => updateCampaign("isActive", event.target.checked)}
              className="h-4 w-4 accent-navy"
            />
            Active
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="form-field"
            value={campaignDraft.title}
            onChange={(event) => updateCampaign("title", event.target.value)}
          />
          <input
            className="form-field"
            value={campaignDraft.targetGroup}
            onChange={(event) => updateCampaign("targetGroup", event.target.value)}
          />
        </div>
        <input
          type="url"
          className="form-field"
          value={campaignDraft.googleFormUrl}
          onChange={(event) => updateCampaign("googleFormUrl", event.target.value)}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <input
            type="url"
            className="form-field md:col-span-2"
            value={campaignDraft.googleSheetUrl}
            placeholder="Google Sheets URL"
            onChange={(event) => updateCampaign("googleSheetUrl", event.target.value)}
          />
          <input
            className="form-field"
            value={campaignDraft.sheetTabName}
            placeholder="Sheet tab"
            onChange={(event) => updateCampaign("sheetTabName", event.target.value)}
          />
        </div>
        <input
          className="form-field"
          value={campaignDraft.googleSheetId}
          placeholder="Google Sheet ID"
          onChange={(event) => updateCampaign("googleSheetId", event.target.value)}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <input
            type="date"
            className="form-field"
            value={campaignDraft.startDate}
            onChange={(event) => updateCampaign("startDate", event.target.value)}
          />
          <input
            type="date"
            className="form-field"
            value={campaignDraft.deadline}
            onChange={(event) => updateCampaign("deadline", event.target.value)}
          />
        </div>
        <textarea
          className="form-field min-h-24"
          value={campaignDraft.description}
          placeholder="Internal description"
          onChange={(event) => updateCampaign("description", event.target.value)}
        />
        <textarea
          className="form-field min-h-24"
          value={campaignDraft.publicNote}
          placeholder="Public note"
          onChange={(event) => updateCampaign("publicNote", event.target.value)}
        />

        <div>
          <CTAButton type="button" onClick={saveCampaign} disabled={saving}>
            <Save aria-hidden className="h-4 w-4" />
            Save Campaign
          </CTAButton>
        </div>
      </section>

      <section className="paper-panel grid gap-5 p-5 md:p-8">
        <div>
          <p className="text-sm font-semibold uppercase text-brass">CSV fallback</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">
            Import official Google Form responses
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink/62">
            Paste exported Google Form response CSV here. Existing imported row numbers are skipped so saved
            statuses and memos stay intact.
          </p>
        </div>
        <textarea
          className="form-field min-h-44 font-mono text-xs"
          placeholder="Paste CSV here..."
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <CTAButton type="button" onClick={importCsv} disabled={importing || !csvText.trim()}>
            <RefreshCcw aria-hidden className="h-4 w-4" />
            {importing ? "Importing..." : "Import CSV"}
          </CTAButton>
          <a
            href={`/api/member-registrations/${campaign.id}/csv-export`}
            className="inline-flex min-h-11 items-center gap-2 border border-navy/20 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
          >
            <Download aria-hidden className="h-4 w-4" />
            Export CSV
          </a>
        </div>
      </section>

      <section className="paper-panel overflow-hidden">
        <div className="grid gap-4 border-b border-ink/10 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-brass">Applicant list</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">
                {applicants.length} applicants
              </h2>
            </div>
            <input
              className="form-field max-w-sm"
              placeholder="Search name, email, status, memo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {filteredApplicants.length > 0 ? (
          <div className="divide-y divide-ink/10">
            {filteredApplicants.map((applicant) => {
              const draft = applicantDrafts[applicant.id] ?? {
                kakaoJoined: applicant.kakaoJoined,
                memo: applicant.memo,
                status: applicant.status
              };

              return (
                <article key={applicant.id} className="grid gap-4 p-5 md:grid-cols-[1.1fr_220px_1fr] md:p-6">
                  <div className="select-text">
                    <p className="font-semibold text-ink">{applicant.applicantName || "No name"}</p>
                    <p className="mt-1 break-all text-sm text-ink/62">
                      {applicant.applicantEmail || "No email"}
                    </p>
                    <p className="mt-1 text-xs text-ink/44">
                      {applicant.externalRowId} / {new Date(applicant.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <select
                      className="form-field"
                      value={draft.status}
                      onChange={(event) => updateApplicant(applicant.id, { status: event.target.value })}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink/70">
                      <input
                        type="checkbox"
                        checked={draft.kakaoJoined}
                        onChange={(event) =>
                          updateApplicant(applicant.id, { kakaoJoined: event.target.checked })
                        }
                        className="h-4 w-4 accent-navy"
                      />
                      Kakao team chat joined
                    </label>
                  </div>
                  <textarea
                    className="form-field min-h-24"
                    placeholder="Officer memo"
                    value={draft.memo}
                    onChange={(event) => updateApplicant(applicant.id, { memo: event.target.value })}
                  />
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-sm leading-7 text-ink/62">
            No applicants to show yet. Import official Google Form responses with CSV after membership
            fee payment.
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <CTAButton type="button" onClick={saveApplicants} disabled={saving || applicants.length === 0}>
          <Save aria-hidden className="h-4 w-4" />
          {saving ? "Saving..." : "Save Applicant Statuses"}
        </CTAButton>
        {message ? <p className="text-sm font-semibold text-pine">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
