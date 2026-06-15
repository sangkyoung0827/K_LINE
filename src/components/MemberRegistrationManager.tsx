"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Plus, QrCode } from "lucide-react";

type Campaign = {
  id: string;
  createdAt: string;
  title: string;
  targetGroup: string;
  googleFormUrl: string;
  deadline: string;
  isActive: boolean;
  publicUrl: string;
};

export function MemberRegistrationManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/member-registrations")
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }: { response: Response; data: { campaigns?: Campaign[]; error?: string } }) => {
        if (!active) {
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Member registration campaigns could not be loaded.");
        }

        setCampaigns(data.campaigns ?? []);
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Campaigns could not be loaded.");
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

  const activeCount = useMemo(() => campaigns.filter((campaign) => campaign.isActive).length, [campaigns]);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setMessage("Registration link copied.");
  };

  if (loading) {
    return <div className="paper-panel p-6 text-sm font-semibold text-ink/62">Loading campaigns...</div>;
  }

  return (
    <div className="grid gap-6">
      <div className="paper-panel flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
        <div>
          <p className="text-sm font-semibold uppercase text-brass">Member registration manager</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">
            {campaigns.length} campaigns / {activeCount} active
          </h2>
        </div>
        <Link
          href="/admin/member-registrations/new"
          className="inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
        >
          <Plus aria-hidden className="h-4 w-4" />
          New Campaign
        </Link>
      </div>

      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-pine">{message}</p> : null}

      {campaigns.length > 0 ? (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <article key={campaign.id} className="paper-panel grid gap-5 p-5 md:grid-cols-[1fr_auto] md:p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-3xl font-semibold text-ink">{campaign.title}</h3>
                  <span
                    className={`border px-2 py-1 text-xs font-semibold ${
                      campaign.isActive
                        ? "border-pine/25 bg-pine/10 text-pine"
                        : "border-ink/10 bg-ink/5 text-ink/58"
                    }`}
                  >
                    {campaign.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink/62">
                  {[campaign.targetGroup, campaign.deadline ? `Deadline: ${campaign.deadline}` : ""]
                    .filter(Boolean)
                    .join(" / ") || "No target group or deadline"}
                </p>
                <p className="mt-2 break-all text-sm text-ink/52">{campaign.publicUrl}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <button
                  type="button"
                  onClick={() => copy(campaign.publicUrl)}
                  className="inline-flex min-h-10 items-center gap-2 border border-navy/20 px-3 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
                >
                  <Copy aria-hidden className="h-4 w-4" />
                  Copy
                </button>
                <a
                  href={`/api/member-registrations/${campaign.id}/qr`}
                  download
                  className="inline-flex min-h-10 items-center gap-2 border border-navy/20 px-3 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
                >
                  <QrCode aria-hidden className="h-4 w-4" />
                  Open Chat QR
                </a>
                <a
                  href={campaign.googleFormUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 border border-navy/20 px-3 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
                >
                  <ExternalLink aria-hidden className="h-4 w-4" />
                  Form
                </a>
                <Link
                  href={`/admin/member-registrations/${campaign.id}`}
                  className="inline-flex min-h-10 items-center bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-navy"
                >
                  Manage
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="paper-panel p-8 text-sm leading-7 text-ink/62">
          No member registration campaigns yet. Create one with the official Google Form URL for members
          who have already paid the membership fee.
        </div>
      )}
    </div>
  );
}
