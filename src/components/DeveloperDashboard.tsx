"use client";

import Link from "next/link";
import { BarChart3, Eye, Globe2, MessageSquareText, Settings, ShieldCheck, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";

type SiteAnalyticsMember = {
  id: string;
  createdAt: string;
  email: string;
  firstLoginAt: string;
  imageUrl: string;
  lastLoginAt: string;
  loginCount: number;
  name: string;
  provider: string;
  role: string;
  status: string;
};

type SiteAnalyticsVisit = {
  id: string;
  createdAt: string;
  path: string;
  referrer: string;
  userEmail: string;
  visitorId: string;
};

type SiteAnalytics = {
  members: SiteAnalyticsMember[];
  recentVisits: SiteAnalyticsVisit[];
  summary: {
    activeMembers: number;
    todayVisits: number;
    totalMembers: number;
    totalVisits: number;
    uniqueVisitors: number;
  };
};

const emptySiteAnalytics: SiteAnalytics = {
  members: [],
  recentVisits: [],
  summary: {
    activeMembers: 0,
    todayVisits: 0,
    totalMembers: 0,
    totalVisits: 0,
    uniqueVisitors: 0
  }
};

function formatDate(value?: string) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function DeveloperDashboard() {
  const [siteAnalytics, setSiteAnalytics] = useState<SiteAnalytics>(emptySiteAnalytics);
  const [siteAnalyticsError, setSiteAnalyticsError] = useState("");

  useEffect(() => {
    async function loadSiteAnalytics() {
      try {
        const response = await fetch("/api/admin/site-analytics");
        const data = (await response.json()) as SiteAnalytics & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Site analytics could not be loaded.");
        }

        setSiteAnalytics({
          members: data.members ?? [],
          recentVisits: data.recentVisits ?? [],
          summary: data.summary ?? emptySiteAnalytics.summary
        });
        setSiteAnalyticsError("");
      } catch (error) {
        setSiteAnalytics(emptySiteAnalytics);
        setSiteAnalyticsError(
          error instanceof Error ? error.message : "Site analytics could not be loaded."
        );
      }
    }

    void loadSiteAnalytics();
  }, []);

  return (
    <>
      <section className="bg-navy py-16 text-paper md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-brass">
            <BarChart3 aria-hidden className="h-5 w-5" />
            개발자 전용
          </div>
          <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">
            K_LINE Developer Console
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-paper/72">
            구글 로그인 회원가입자 수, 방문자 수, 방문 기록 등 향후 데이터 관리를 위한 개발자 전용 화면입니다.
          </p>
        </div>
      </section>

      <section className="bg-paper py-10 md:py-14">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 md:grid-cols-3 md:px-8">
          <MetricCard
            icon={<UserCheck aria-hidden className="h-5 w-5" />}
            label="Google members"
            value={`${siteAnalytics.summary.totalMembers}`}
            note={`${siteAnalytics.summary.activeMembers} active`}
          />
          <MetricCard
            icon={<Globe2 aria-hidden className="h-5 w-5" />}
            label="Unique visitors"
            value={`${siteAnalytics.summary.uniqueVisitors}`}
            note={`${siteAnalytics.summary.todayVisits} visits today`}
          />
          <MetricCard
            icon={<Eye aria-hidden className="h-5 w-5" />}
            label="Page visits"
            value={`${siteAnalytics.summary.totalVisits}`}
            note="Public page tracking"
          />
        </div>
      </section>

      <section className="bg-white/55 py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <h2 className="font-serif text-3xl font-semibold text-ink">Developer Menu</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <DeveloperMenuCard
              href="/developer/feedback"
              icon={<MessageSquareText aria-hidden className="h-5 w-5" />}
              title="Site Feedback"
              description="Read, resolve, and delete developer-only site feedback."
            />
            <DeveloperMenuCard
              href="/developer"
              icon={<Settings aria-hidden className="h-5 w-5" />}
              title="Developer Settings"
              description="Review developer analytics and configuration status."
            />
            <DeveloperMenuCard
              href="/our-activities/ecc/members"
              icon={<ShieldCheck aria-hidden className="h-5 w-5" />}
              title="Role Acquisition Account Info"
              description="Open ECC permission management with developer-only account details."
            />
          </div>
        </div>
      </section>

      <section className="bg-paper py-12 md:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 md:px-8 xl:grid-cols-[1fr_1fr]">
          <DeveloperPanel title="Google Login Members">
            {siteAnalyticsError ? (
              <p className="mb-4 text-sm font-semibold text-red-700">{siteAnalyticsError}</p>
            ) : null}
            {siteAnalytics.members.length > 0 ? (
              <div className="grid gap-3">
                {siteAnalytics.members.map((member) => (
                  <div key={member.id} className="border border-ink/10 bg-white/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{member.name || "No name"}</p>
                        <p className="mt-1 text-sm text-ink/62">{member.email}</p>
                        <p className="mt-1 text-xs font-semibold uppercase text-brass">
                          {member.provider || "google"} / {member.status} / {member.loginCount} logins
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-ink/46">
                        Last login {formatDate(member.lastLoginAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-7 text-ink/62">
                No Google login members are stored yet. They will appear here after signing in.
              </p>
            )}
          </DeveloperPanel>

          <DeveloperPanel title="Recent Visits">
            {siteAnalytics.recentVisits.length > 0 ? (
              <div className="grid gap-2">
                {siteAnalytics.recentVisits.map((visit) => (
                  <div key={visit.id} className="border border-ink/10 bg-white/45 p-3 text-sm">
                    <p className="font-semibold text-ink">{visit.path || "/"}</p>
                    <p className="mt-1 text-xs text-ink/52">
                      {visit.userEmail || "anonymous"} / {formatDate(visit.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-7 text-ink/62">No visits are tracked yet.</p>
            )}
          </DeveloperPanel>
        </div>
      </section>
    </>
  );
}

function DeveloperMenuCard({
  description,
  href,
  icon,
  title
}: {
  description: string;
  href: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="border border-ink/10 bg-paper/92 p-5 shadow-soft transition hover:-translate-y-1 hover:border-brass/50 hover:bg-white"
    >
      <span className="flex h-10 w-10 items-center justify-center bg-navy text-paper">
        {icon}
      </span>
      <h3 className="mt-5 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/62">{description}</p>
    </Link>
  );
}

function MetricCard({
  icon,
  label,
  note,
  value
}: {
  icon: React.ReactNode;
  label: string;
  note: string;
  value: string;
}) {
  return (
    <div className="border border-ink/10 bg-white/70 p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase text-ink/52">{label}</p>
        <span className="inline-flex h-9 w-9 items-center justify-center bg-hanji text-brass">
          {icon}
        </span>
      </div>
      <p className="mt-5 font-serif text-4xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink/58">{note}</p>
    </div>
  );
}

function DeveloperPanel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="border border-ink/10 bg-paper/92 p-5 shadow-soft md:p-7">
      <h2 className="font-serif text-3xl font-semibold text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
