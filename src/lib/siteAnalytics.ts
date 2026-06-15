import "server-only";

import {
  cleanText,
  getSupabaseConfig,
  SupabaseConfigError,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";
import { normalizeEmail } from "@/lib/admin";

export type SiteMemberRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  email: string;
  name: string | null;
  image_url: string | null;
  provider: string | null;
  provider_account_id: string | null;
  role: string | null;
  status: string | null;
  first_login_at: string | null;
  last_login_at: string | null;
  login_count: number | null;
};

export type SiteVisitorRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  visitor_id: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_path: string | null;
  last_referrer: string | null;
  user_email: string | null;
  visit_count: number | null;
};

export type SiteVisitRow = {
  id: string;
  created_at: string;
  visitor_id: string;
  path: string | null;
  referrer: string | null;
  user_email: string | null;
  user_agent: string | null;
};

export type SiteMember = {
  id: string;
  createdAt: string;
  updatedAt: string;
  email: string;
  name: string;
  imageUrl: string;
  provider: string;
  providerAccountId: string;
  role: string;
  status: string;
  firstLoginAt: string;
  lastLoginAt: string;
  loginCount: number;
};

export type SiteVisit = {
  id: string;
  createdAt: string;
  visitorId: string;
  path: string;
  referrer: string;
  userEmail: string;
  userAgent: string;
};

export type SiteAnalyticsDashboard = {
  members: SiteMember[];
  recentVisits: SiteVisit[];
  summary: {
    totalMembers: number;
    activeMembers: number;
    uniqueVisitors: number;
    totalVisits: number;
    todayVisits: number;
  };
};

export type RegisterSiteMemberInput = {
  email?: string | null;
  name?: string | null;
  imageUrl?: string | null;
  provider?: string | null;
  providerAccountId?: string | null;
};

export type RecordSiteVisitInput = {
  visitorId?: unknown;
  path?: unknown;
  referrer?: unknown;
  userAgent?: string | null;
  userEmail?: string | null;
};

const siteMembersTable = "site_members";
const siteVisitorsTable = "site_visitors";
const siteVisitsTable = "site_visits";
const siteMemberColumns =
  "id,created_at,updated_at,email,name,image_url,provider,provider_account_id,role,status,first_login_at,last_login_at,login_count";
const siteVisitorColumns =
  "id,created_at,updated_at,visitor_id,first_seen_at,last_seen_at,last_path,last_referrer,user_email,visit_count";
const siteVisitColumns = "id,created_at,visitor_id,path,referrer,user_email,user_agent";

export async function registerSiteMember(input: RegisterSiteMemberInput) {
  const email = normalizeEmail(input.email);

  if (!email) {
    return null;
  }

  const now = new Date().toISOString();
  const existingRows = await supabaseRequest<SiteMemberRow[]>(
    `${siteMembersTable}?select=${siteMemberColumns}&email=eq.${encodeURIComponent(email)}&limit=1`
  );
  const existing = existingRows[0];

  if (existing) {
    const rows = await supabaseRequest<SiteMemberRow[]>(
      `${siteMembersTable}?id=eq.${encodeURIComponent(existing.id)}&select=${siteMemberColumns}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          image_url: cleanText(input.imageUrl, 1000) || existing.image_url || "",
          last_login_at: now,
          login_count: Number(existing.login_count ?? 0) + 1,
          name: cleanText(input.name, 240) || existing.name || "",
          provider: cleanText(input.provider, 80) || existing.provider || "google",
          provider_account_id:
            cleanText(input.providerAccountId, 240) || existing.provider_account_id || "",
          status: existing.status || "active",
          updated_at: now
        })
      }
    );

    return rows[0] ? toSiteMember(rows[0]) : null;
  }

  const rows = await supabaseRequest<SiteMemberRow[]>(
    `${siteMembersTable}?select=${siteMemberColumns}`,
    {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        email,
        first_login_at: now,
        image_url: cleanText(input.imageUrl, 1000),
        last_login_at: now,
        login_count: 1,
        name: cleanText(input.name, 240),
        provider: cleanText(input.provider, 80) || "google",
        provider_account_id: cleanText(input.providerAccountId, 240),
        role: "member",
        status: "active",
        updated_at: now
      })
    }
  );

  return rows[0] ? toSiteMember(rows[0]) : null;
}

export async function recordSiteVisit(input: RecordSiteVisitInput) {
  const visitorId = cleanText(input.visitorId, 120);

  if (!visitorId) {
    return;
  }

  const now = new Date().toISOString();
  const path = cleanText(input.path, 1000) || "/";
  const referrer = cleanText(input.referrer, 1000);
  const userEmail = normalizeEmail(input.userEmail);
  const userAgent = cleanText(input.userAgent, 600);

  const existingVisitors = await supabaseRequest<SiteVisitorRow[]>(
    `${siteVisitorsTable}?select=${siteVisitorColumns}&visitor_id=eq.${encodeURIComponent(
      visitorId
    )}&limit=1`
  );
  const existingVisitor = existingVisitors[0];

  if (existingVisitor) {
    await supabaseRequest<SiteVisitorRow[]>(
      `${siteVisitorsTable}?id=eq.${encodeURIComponent(
        existingVisitor.id
      )}&select=${siteVisitorColumns}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          last_path: path,
          last_referrer: referrer,
          last_seen_at: now,
          updated_at: now,
          user_email: userEmail || existingVisitor.user_email || "",
          visit_count: Number(existingVisitor.visit_count ?? 0) + 1
        })
      }
    );
  } else {
    await supabaseRequest<SiteVisitorRow[]>(
      `${siteVisitorsTable}?select=${siteVisitorColumns}`,
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          first_seen_at: now,
          last_path: path,
          last_referrer: referrer,
          last_seen_at: now,
          updated_at: now,
          user_email: userEmail,
          visit_count: 1,
          visitor_id: visitorId
        })
      }
    );
  }

  await supabaseRequest<SiteVisitRow[]>(`${siteVisitsTable}?select=${siteVisitColumns}`, {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      path,
      referrer,
      user_agent: userAgent,
      user_email: userEmail,
      visitor_id: visitorId
    })
  });
}

export async function getSiteAnalyticsDashboard(): Promise<SiteAnalyticsDashboard> {
  const [members, recentVisits, totalMembers, activeMembers, uniqueVisitors, totalVisits, todayVisits] =
    await Promise.all([
      supabaseRequest<SiteMemberRow[]>(
        `${siteMembersTable}?select=${siteMemberColumns}&order=last_login_at.desc.nullslast&limit=200`
      ),
      supabaseRequest<SiteVisitRow[]>(
        `${siteVisitsTable}?select=${siteVisitColumns}&order=created_at.desc&limit=80`
      ),
      supabaseCount(`${siteMembersTable}?select=id`),
      supabaseCount(`${siteMembersTable}?select=id&status=eq.active`),
      supabaseCount(`${siteVisitorsTable}?select=id`),
      supabaseCount(`${siteVisitsTable}?select=id`),
      supabaseCount(
        `${siteVisitsTable}?select=id&created_at=gte.${encodeURIComponent(startOfTodayIso())}`
      )
    ]);

  return {
    members: members.map(toSiteMember),
    recentVisits: recentVisits.map(toSiteVisit),
    summary: {
      activeMembers,
      todayVisits,
      totalMembers,
      totalVisits,
      uniqueVisitors
    }
  };
}

export function toSiteMember(row: SiteMemberRow): SiteMember {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    email: row.email,
    firstLoginAt: row.first_login_at ?? row.created_at,
    imageUrl: row.image_url ?? "",
    lastLoginAt: row.last_login_at ?? row.created_at,
    loginCount: Number(row.login_count ?? 0),
    name: row.name ?? "",
    provider: row.provider ?? "",
    providerAccountId: row.provider_account_id ?? "",
    role: row.role ?? "member",
    status: row.status ?? "active"
  };
}

export function toSiteVisit(row: SiteVisitRow): SiteVisit {
  return {
    id: row.id,
    createdAt: row.created_at,
    path: row.path ?? "",
    referrer: row.referrer ?? "",
    userAgent: row.user_agent ?? "",
    userEmail: row.user_email ?? "",
    visitorId: row.visitor_id
  };
}

async function supabaseCount(path: string) {
  const config = getSupabaseConfig();
  const headers = new Headers();
  headers.set("apikey", config.serviceRoleKey);
  headers.set("Authorization", `Bearer ${config.serviceRoleKey}`);
  headers.set("Prefer", "count=exact");
  headers.set("Range", "0-0");

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: "HEAD",
    headers
  });

  if (!response.ok) {
    throw new SupabaseRequestError(await response.text(), response.status);
  }

  const contentRange = response.headers.get("content-range") ?? "";
  const countText = contentRange.split("/").pop() ?? "0";
  return Number(countText) || 0;
}

function startOfTodayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export function isSiteAnalyticsStorageError(error: unknown) {
  return error instanceof SupabaseConfigError || error instanceof SupabaseRequestError;
}
