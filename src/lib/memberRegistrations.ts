import "server-only";

import { siteConfig } from "@/lib/seo";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";

export type MemberRegistrationCampaignRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  title: string;
  description: string | null;
  target_group: string | null;
  google_form_url: string;
  google_sheet_url: string | null;
  google_sheet_id: string | null;
  sheet_tab_name: string | null;
  start_date: string | null;
  deadline: string | null;
  is_active: boolean | null;
  public_note: string | null;
  created_by: string | null;
};

export type MemberRegistrationApplicantStatusRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  campaign_id: string;
  external_row_id: string;
  applicant_name: string | null;
  applicant_email: string | null;
  status: string | null;
  kakao_joined: boolean | null;
  memo: string | null;
  updated_by: string | null;
};

export type MemberRegistrationCampaign = {
  id: string;
  createdAt: string;
  updatedAt: string;
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
  createdBy: string;
  publicUrl: string;
};

export type MemberRegistrationApplicantStatus = {
  id: string;
  createdAt: string;
  updatedAt: string;
  campaignId: string;
  externalRowId: string;
  applicantName: string;
  applicantEmail: string;
  status: string;
  kakaoJoined: boolean;
  memo: string;
  updatedBy: string;
};

export type MemberRegistrationCampaignInput = {
  title?: unknown;
  description?: unknown;
  targetGroup?: unknown;
  googleFormUrl?: unknown;
  googleSheetUrl?: unknown;
  googleSheetId?: unknown;
  sheetTabName?: unknown;
  startDate?: unknown;
  deadline?: unknown;
  isActive?: unknown;
  publicNote?: unknown;
};

export const campaignTable = "member_registration_campaigns";
export const applicantStatusTable = "member_registration_applicant_statuses";

export const campaignColumns =
  "id,created_at,updated_at,title,description,target_group,google_form_url,google_sheet_url,google_sheet_id,sheet_tab_name,start_date,deadline,is_active,public_note,created_by";

export const applicantStatusColumns =
  "id,created_at,updated_at,campaign_id,external_row_id,applicant_name,applicant_email,status,kakao_joined,memo,updated_by";

const allowedApplicantStatuses = new Set([
  "pending",
  "approved",
  "paid",
  "invited",
  "rejected",
  "waitlist"
]);

export function publicRegistrationUrl(campaignId: string) {
  return `${siteConfig.url}/register/${campaignId}`;
}

export function toCampaign(row: MemberRegistrationCampaignRow): MemberRegistrationCampaign {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    title: row.title,
    description: row.description ?? "",
    targetGroup: row.target_group ?? "",
    googleFormUrl: row.google_form_url,
    googleSheetUrl: row.google_sheet_url ?? "",
    googleSheetId: row.google_sheet_id ?? "",
    sheetTabName: row.sheet_tab_name ?? "",
    startDate: row.start_date ?? "",
    deadline: row.deadline ?? "",
    isActive: Boolean(row.is_active),
    publicNote: row.public_note ?? "",
    createdBy: row.created_by ?? "",
    publicUrl: publicRegistrationUrl(row.id)
  };
}

export function toApplicantStatus(
  row: MemberRegistrationApplicantStatusRow
): MemberRegistrationApplicantStatus {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    campaignId: row.campaign_id,
    externalRowId: row.external_row_id,
    applicantName: row.applicant_name ?? "",
    applicantEmail: row.applicant_email ?? "",
    status: normalizeApplicantStatus(row.status),
    kakaoJoined: Boolean(row.kakao_joined),
    memo: row.memo ?? "",
    updatedBy: row.updated_by ?? ""
  };
}

export function normalizeApplicantStatus(value: unknown) {
  const status = cleanText(value, 40).toLowerCase();
  return allowedApplicantStatuses.has(status) ? status : "pending";
}

export function normalizeCampaignInput(input: MemberRegistrationCampaignInput) {
  const title = cleanText(input.title, 160);
  const googleFormUrl = cleanUrl(input.googleFormUrl, 1200);

  return {
    title,
    description: cleanText(input.description, 1400),
    target_group: cleanText(input.targetGroup, 160),
    google_form_url: googleFormUrl,
    google_sheet_url: cleanUrl(input.googleSheetUrl, 1200),
    google_sheet_id: cleanText(input.googleSheetId, 240),
    sheet_tab_name: cleanText(input.sheetTabName, 160),
    start_date: cleanDate(input.startDate),
    deadline: cleanDate(input.deadline),
    is_active: Boolean(input.isActive),
    public_note: cleanText(input.publicNote, 1400)
  };
}

export function validateCampaignPayload(input: ReturnType<typeof normalizeCampaignInput>) {
  if (!input.title) {
    return "Campaign title is required.";
  }

  if (!input.google_form_url) {
    return "Official Google Form URL is required.";
  }

  return "";
}

export async function listMemberRegistrationCampaigns() {
  const rows = await supabaseRequest<MemberRegistrationCampaignRow[]>(
    `${campaignTable}?select=${campaignColumns}&order=created_at.desc`
  );

  return rows.map(toCampaign);
}

export async function getMemberRegistrationCampaign(campaignId: string) {
  const rows = await supabaseRequest<MemberRegistrationCampaignRow[]>(
    `${campaignTable}?select=${campaignColumns}&id=eq.${encodeURIComponent(campaignId)}&limit=1`
  );

  return rows[0] ? toCampaign(rows[0]) : null;
}

export async function getPublicMemberRegistrationCampaign(campaignId: string) {
  const rows = await supabaseRequest<MemberRegistrationCampaignRow[]>(
    `${campaignTable}?select=${campaignColumns}&id=eq.${encodeURIComponent(
      campaignId
    )}&is_active=eq.true&limit=1`
  );

  return rows[0] ? toCampaign(rows[0]) : null;
}

export async function createMemberRegistrationCampaign(
  input: ReturnType<typeof normalizeCampaignInput>,
  createdBy: string
) {
  const rows = await supabaseRequest<MemberRegistrationCampaignRow[]>(
    `${campaignTable}?select=${campaignColumns}`,
    {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        ...input,
        created_by: createdBy,
        updated_at: new Date().toISOString()
      })
    }
  );

  return rows[0] ? toCampaign(rows[0]) : null;
}

export async function updateMemberRegistrationCampaign(
  campaignId: string,
  input: ReturnType<typeof normalizeCampaignInput>
) {
  const rows = await supabaseRequest<MemberRegistrationCampaignRow[]>(
    `${campaignTable}?id=eq.${encodeURIComponent(campaignId)}&select=${campaignColumns}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        ...input,
        updated_at: new Date().toISOString()
      })
    }
  );

  return rows[0] ? toCampaign(rows[0]) : null;
}

export async function listMemberRegistrationApplicants(campaignId: string) {
  const rows = await supabaseRequest<MemberRegistrationApplicantStatusRow[]>(
    `${applicantStatusTable}?select=${applicantStatusColumns}&campaign_id=eq.${encodeURIComponent(
      campaignId
    )}&order=created_at.desc`
  );

  return rows.map(toApplicantStatus);
}

function cleanUrl(value: unknown, maxLength: number) {
  const url = cleanText(value, maxLength);

  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function cleanDate(value: unknown) {
  const text = cleanText(value, 40);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
