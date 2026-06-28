import "server-only";

import { auth } from "@/auth";
import { normalizeEmail } from "@/lib/admin";
import { getCurrentEccAccess, getEccRoleRow } from "@/lib/eccAccess";
import { getEccMemberRegistrationByEmail } from "@/lib/eccMemberRegistrations";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";

export type AlumniNoticeVisibility =
  | "public"
  | "logged_in_only"
  | "alumni_only"
  | "official_member_only";
export type AlumniInquiryStatus = "submitted" | "reviewing" | "approved" | "rejected" | "replied";
export type RejoinRequestStatus =
  | "submitted"
  | "payment_pending"
  | "payment_confirmed"
  | "approved"
  | "rejected";

export type AlumniNoticeRow = {
  id: string;
  title: string;
  content: string;
  created_by: string | null;
  is_pinned: boolean | null;
  visibility: AlumniNoticeVisibility | null;
  created_at: string;
  updated_at: string | null;
};

export type AlumniInquiryRow = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  kakao_display_name: string;
  current_status: string;
  requested_activity: string;
  message: string;
  availability: string;
  status: AlumniInquiryStatus | null;
  admin_note: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type RejoinRequestRow = {
  id: string;
  user_id: string | null;
  google_email: string;
  google_name: string | null;
  google_avatar_url: string | null;
  full_name: string;
  student_id: string | null;
  department_or_major: string;
  nationality: string;
  kakao_display_name: string;
  kakao_id: string;
  current_status: string;
  message: string | null;
  status: RejoinRequestStatus | null;
  payment_confirmed: boolean | null;
  payment_confirmed_by: string | null;
  payment_confirmed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
};

export const alumniNoticeColumns =
  "id,title,content,created_by,is_pinned,visibility,created_at,updated_at";
export const alumniInquiryColumns =
  "id,user_id,name,email,kakao_display_name,current_status,requested_activity,message,availability,status,admin_note,handled_by,handled_at,created_at,updated_at";
export const rejoinRequestColumns =
  "id,user_id,google_email,google_name,google_avatar_url,full_name,student_id,department_or_major,nationality,kakao_display_name,kakao_id,current_status,message,status,payment_confirmed,payment_confirmed_by,payment_confirmed_at,approved_by,approved_at,admin_note,created_at,updated_at";

export function canReadNotice(
  visibility: AlumniNoticeVisibility,
  access: Awaited<ReturnType<typeof getCurrentEccAccess>>,
  hasAlumniHistory: boolean
) {
  if (visibility === "public") return true;
  if (visibility === "logged_in_only") return access.isLoggedIn;
  if (visibility === "official_member_only") return access.isOfficialMember;
  return access.isOfficialMember || hasAlumniHistory;
}

export async function hasPreviousEccHistory(email?: string | null) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return false;
  }

  const [registration, roleRow] = await Promise.all([
    getEccMemberRegistrationByEmail(normalized).catch(() => null),
    getEccRoleRow(normalized).catch(() => null)
  ]);

  return Boolean(
    registration ||
      roleRow?.official_member_status === "approved" ||
      roleRow?.official_member_status === "rejected" ||
      roleRow?.is_official_member ||
      roleRow?.payment_confirmed
  );
}

export async function listReadableAlumniNotices() {
  const access = await getCurrentEccAccess();
  const hasHistory = await hasPreviousEccHistory(access.email);
  const rows = await supabaseRequest<AlumniNoticeRow[]>(
    `ecc_alumni_notices?select=${alumniNoticeColumns}&order=is_pinned.desc,created_at.desc&limit=100`
  );

  return rows.filter((row) =>
    canReadNotice(row.visibility ?? "public", access, hasHistory)
  );
}

export async function listAllAlumniNotices() {
  return supabaseRequest<AlumniNoticeRow[]>(
    `ecc_alumni_notices?select=${alumniNoticeColumns}&order=is_pinned.desc,created_at.desc&limit=500`
  );
}

export async function createAlumniNotice(input: {
  content: unknown;
  createdBy: string;
  isPinned?: unknown;
  title: unknown;
  visibility?: unknown;
}) {
  const visibility = cleanText(input.visibility, 80) as AlumniNoticeVisibility;
  const now = new Date().toISOString();
  const rows = await supabaseRequest<AlumniNoticeRow[]>(
    `ecc_alumni_notices?select=${alumniNoticeColumns}`,
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        content: cleanText(input.content, 4000),
        created_at: now,
        created_by: input.createdBy,
        is_pinned: Boolean(input.isPinned),
        title: cleanText(input.title, 240),
        updated_at: now,
        visibility:
          visibility === "logged_in_only" ||
          visibility === "alumni_only" ||
          visibility === "official_member_only"
            ? visibility
            : "public"
      })
    }
  );

  return rows[0] ?? null;
}

export async function patchAlumniNotice(input: {
  content?: unknown;
  id: string;
  isPinned?: unknown;
  title?: unknown;
  visibility?: unknown;
}) {
  const visibility = cleanText(input.visibility, 80) as AlumniNoticeVisibility;
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.title !== undefined) body.title = cleanText(input.title, 240);
  if (input.content !== undefined) body.content = cleanText(input.content, 4000);
  if (input.isPinned !== undefined) body.is_pinned = Boolean(input.isPinned);
  if (visibility) body.visibility = visibility;

  const rows = await supabaseRequest<AlumniNoticeRow[]>(
    `ecc_alumni_notices?id=eq.${encodeURIComponent(input.id)}&select=${alumniNoticeColumns}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body)
    }
  );

  return rows[0] ?? null;
}

export async function deleteAlumniNotice(id: string) {
  await supabaseRequest<null>(`ecc_alumni_notices?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
}

export async function listAlumniInquiries(admin = false, email = "") {
  const query = admin
    ? `ecc_alumni_activity_inquiries?select=${alumniInquiryColumns}&order=created_at.desc&limit=500`
    : `ecc_alumni_activity_inquiries?select=${alumniInquiryColumns}&email=eq.${encodeURIComponent(
        normalizeEmail(email)
      )}&order=created_at.desc&limit=50`;

  return supabaseRequest<AlumniInquiryRow[]>(query);
}

export async function createAlumniInquiry(input: Record<string, unknown>, email: string) {
  const now = new Date().toISOString();
  const rows = await supabaseRequest<AlumniInquiryRow[]>(
    `ecc_alumni_activity_inquiries?select=${alumniInquiryColumns}`,
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        availability: cleanText(input.availability, 1000),
        created_at: now,
        current_status: cleanText(input.current_status ?? input.currentStatus, 160),
        email: normalizeEmail(email) || cleanText(input.email, 240),
        kakao_display_name: cleanText(
          input.kakao_display_name ?? input.kakaoDisplayName,
          240
        ),
        message: cleanText(input.message, 2000),
        name: cleanText(input.name, 240),
        requested_activity: cleanText(
          input.requested_activity ?? input.requestedActivity,
          240
        ),
        status: "submitted",
        updated_at: now,
        user_id: normalizeEmail(email)
      })
    }
  );

  return rows[0] ?? null;
}

export async function patchAlumniInquiry(input: {
  adminEmail: string;
  adminNote?: unknown;
  id: string;
  status?: unknown;
}) {
  const status = cleanText(input.status, 80) as AlumniInquiryStatus;
  const now = new Date().toISOString();
  const rows = await supabaseRequest<AlumniInquiryRow[]>(
    `ecc_alumni_activity_inquiries?id=eq.${encodeURIComponent(
      input.id
    )}&select=${alumniInquiryColumns}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        admin_note: cleanText(input.adminNote, 1200),
        handled_at: now,
        handled_by: input.adminEmail,
        status:
          status === "reviewing" ||
          status === "approved" ||
          status === "rejected" ||
          status === "replied"
            ? status
            : "submitted",
        updated_at: now
      })
    }
  );

  return rows[0] ?? null;
}

export async function getCurrentSessionIdentity() {
  const session = await auth();
  return {
    avatarUrl: session?.user?.image ?? "",
    email: normalizeEmail(session?.user?.email),
    name: session?.user?.name ?? ""
  };
}

export async function listRejoinRequests(admin = false, email = "") {
  const query = admin
    ? `ecc_rejoin_requests?select=${rejoinRequestColumns}&order=created_at.desc&limit=500`
    : `ecc_rejoin_requests?select=${rejoinRequestColumns}&google_email=eq.${encodeURIComponent(
        normalizeEmail(email)
      )}&order=created_at.desc&limit=50`;

  return supabaseRequest<RejoinRequestRow[]>(query);
}

export async function createRejoinRequest(input: Record<string, unknown>) {
  const identity = await getCurrentSessionIdentity();
  const now = new Date().toISOString();

  if (!identity.email) {
    throw new Error("Login required.");
  }

  const rows = await supabaseRequest<RejoinRequestRow[]>(
    `ecc_rejoin_requests?select=${rejoinRequestColumns}`,
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        created_at: now,
        current_status: cleanText(input.current_status ?? input.currentStatus, 160),
        department_or_major: cleanText(
          input.department_or_major ?? input.departmentOrMajor,
          240
        ),
        full_name: cleanText(input.full_name ?? input.fullName, 240),
        google_avatar_url: identity.avatarUrl,
        google_email: identity.email,
        google_name: identity.name,
        kakao_display_name: cleanText(
          input.kakao_display_name ?? input.kakaoDisplayName,
          240
        ),
        kakao_id: cleanText(input.kakao_id ?? input.kakaoId, 240),
        message: cleanText(input.message, 1200),
        nationality: cleanText(input.nationality, 160),
        payment_confirmed: false,
        status: "submitted",
        student_id: cleanText(input.student_id ?? input.studentId, 120),
        updated_at: now,
        user_id: identity.email
      })
    }
  );

  return rows[0] ?? null;
}

export async function patchRejoinRequest(input: {
  adminEmail: string;
  adminNote?: unknown;
  id: string;
  paymentConfirmed?: unknown;
  status?: unknown;
}) {
  const paymentConfirmed = Boolean(input.paymentConfirmed);
  const status = cleanText(input.status, 80) as RejoinRequestStatus;
  const approved = status === "approved";
  const now = new Date().toISOString();
  const rows = await supabaseRequest<RejoinRequestRow[]>(
    `ecc_rejoin_requests?id=eq.${encodeURIComponent(input.id)}&select=${rejoinRequestColumns}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        admin_note: cleanText(input.adminNote, 1200),
        approved_at: approved ? now : null,
        approved_by: approved ? input.adminEmail : null,
        payment_confirmed: paymentConfirmed,
        payment_confirmed_at: paymentConfirmed ? now : null,
        payment_confirmed_by: paymentConfirmed ? input.adminEmail : null,
        status:
          status === "payment_pending" ||
          status === "payment_confirmed" ||
          status === "approved" ||
          status === "rejected"
            ? status
            : "submitted",
        updated_at: now
      })
    }
  );

  return rows[0] ?? null;
}
