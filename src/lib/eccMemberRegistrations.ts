import "server-only";

import { normalizeEmail } from "@/lib/admin";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";

export type EccMemberRegistrationStatus =
  | "submitted"
  | "payment_pending"
  | "approved"
  | "rejected";

export type EccMemberRegistrationRow = {
  id: string;
  site_member_id: string | null;
  google_email: string;
  google_name: string | null;
  google_avatar_url: string | null;
  full_name: string;
  student_id: string;
  department_or_major: string;
  nationality: string;
  gender: string;
  kakao_display_name: string;
  kakao_id: string;
  payment_confirmed: boolean | null;
  payment_confirmed_by: string | null;
  payment_confirmed_at: string | null;
  official_member: boolean | null;
  official_member_approved_by: string | null;
  official_member_approved_at: string | null;
  status: EccMemberRegistrationStatus | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
};

export type EccMemberRegistration = {
  id: string;
  siteMemberId: string;
  googleEmail: string;
  googleName: string;
  googleAvatarUrl: string;
  fullName: string;
  studentId: string;
  departmentOrMajor: string;
  nationality: string;
  gender: string;
  kakaoDisplayName: string;
  kakaoId: string;
  paymentConfirmed: boolean;
  paymentConfirmedBy: string;
  paymentConfirmedAt: string;
  officialMember: boolean;
  officialMemberApprovedBy: string;
  officialMemberApprovedAt: string;
  status: EccMemberRegistrationStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
};

export type EccMemberRegistrationFormInput = {
  departmentOrMajor?: unknown;
  department_or_major?: unknown;
  fullName?: unknown;
  full_name?: unknown;
  gender?: unknown;
  kakaoDisplayName?: unknown;
  kakao_display_name?: unknown;
  kakaoId?: unknown;
  kakao_id?: unknown;
  nationality?: unknown;
  studentId?: unknown;
  student_id?: unknown;
};

export const eccMemberRegistrationsTable = "ecc_member_registrations";
export const eccMemberRegistrationColumns =
  "id,site_member_id,google_email,google_name,google_avatar_url,full_name,student_id,department_or_major,nationality,gender,kakao_display_name,kakao_id,payment_confirmed,payment_confirmed_by,payment_confirmed_at,official_member,official_member_approved_by,official_member_approved_at,status,admin_note,created_at,updated_at";

export function toEccMemberRegistration(row: EccMemberRegistrationRow): EccMemberRegistration {
  return {
    adminNote: row.admin_note ?? "",
    createdAt: row.created_at,
    departmentOrMajor: row.department_or_major,
    fullName: row.full_name,
    gender: row.gender,
    googleAvatarUrl: row.google_avatar_url ?? "",
    googleEmail: row.google_email,
    googleName: row.google_name ?? "",
    id: row.id,
    kakaoDisplayName: row.kakao_display_name,
    kakaoId: row.kakao_id,
    nationality: row.nationality,
    officialMember: Boolean(row.official_member),
    officialMemberApprovedAt: row.official_member_approved_at ?? "",
    officialMemberApprovedBy: row.official_member_approved_by ?? "",
    paymentConfirmed: Boolean(row.payment_confirmed),
    paymentConfirmedAt: row.payment_confirmed_at ?? "",
    paymentConfirmedBy: row.payment_confirmed_by ?? "",
    siteMemberId: row.site_member_id ?? "",
    status: row.status ?? "payment_pending",
    studentId: row.student_id,
    updatedAt: row.updated_at ?? row.created_at
  };
}

export function cleanEccMemberRegistrationFormInput(input: EccMemberRegistrationFormInput) {
  return {
    departmentOrMajor: cleanText(input.departmentOrMajor ?? input.department_or_major, 240),
    fullName: cleanText(input.fullName ?? input.full_name, 240),
    gender: cleanText(input.gender, 80),
    kakaoDisplayName: cleanText(input.kakaoDisplayName ?? input.kakao_display_name, 240),
    kakaoId: cleanText(input.kakaoId ?? input.kakao_id, 240),
    nationality: cleanText(input.nationality, 160),
    studentId: cleanText(input.studentId ?? input.student_id, 120)
  };
}

export function validateEccMemberRegistrationForm(input: ReturnType<typeof cleanEccMemberRegistrationFormInput>) {
  const missing = Object.entries(input)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return missing;
}

export async function getEccMemberRegistrationByEmail(email?: string | null) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return null;
  }

  const rows = await supabaseRequest<EccMemberRegistrationRow[]>(
    `${eccMemberRegistrationsTable}?select=${eccMemberRegistrationColumns}&google_email=eq.${encodeURIComponent(
      normalized
    )}&order=created_at.desc&limit=1`
  );

  return rows[0] ? toEccMemberRegistration(rows[0]) : null;
}

export async function listEccMemberRegistrations() {
  const rows = await supabaseRequest<EccMemberRegistrationRow[]>(
    `${eccMemberRegistrationsTable}?select=${eccMemberRegistrationColumns}&order=created_at.desc&limit=1000`
  );

  return rows.map(toEccMemberRegistration);
}

export async function upsertEccMemberRegistration(input: {
  form: ReturnType<typeof cleanEccMemberRegistrationFormInput>;
  googleAvatarUrl?: string | null;
  googleEmail: string;
  googleName?: string | null;
  siteMemberId?: string | null;
}) {
  const email = normalizeEmail(input.googleEmail);
  const existing = await getEccMemberRegistrationByEmail(email);
  const now = new Date().toISOString();

  const payload = {
    department_or_major: input.form.departmentOrMajor,
    full_name: input.form.fullName,
    gender: input.form.gender,
    google_avatar_url: cleanText(input.googleAvatarUrl, 1000),
    google_email: email,
    google_name: cleanText(input.googleName),
    kakao_display_name: input.form.kakaoDisplayName,
    kakao_id: input.form.kakaoId,
    nationality: input.form.nationality,
    site_member_id: input.siteMemberId || null,
    status: existing?.status === "rejected" ? "submitted" : "payment_pending",
    student_id: input.form.studentId,
    updated_at: now
  };

  if (existing) {
    const rows = await supabaseRequest<EccMemberRegistrationRow[]>(
      `${eccMemberRegistrationsTable}?id=eq.${encodeURIComponent(
        existing.id
      )}&select=${eccMemberRegistrationColumns}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      }
    );

    return rows[0] ? toEccMemberRegistration(rows[0]) : existing;
  }

  const rows = await supabaseRequest<EccMemberRegistrationRow[]>(
    `${eccMemberRegistrationsTable}?select=${eccMemberRegistrationColumns}`,
    {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        ...payload,
        created_at: now,
        payment_confirmed: false,
        official_member: false
      })
    }
  );

  return rows[0] ? toEccMemberRegistration(rows[0]) : null;
}

export async function patchEccMemberRegistration(input: {
  adminEmail: string;
  adminNote?: string;
  id: string;
  paymentConfirmed: boolean;
}) {
  const now = new Date().toISOString();
  const paymentConfirmed = Boolean(input.paymentConfirmed);
  const rows = await supabaseRequest<EccMemberRegistrationRow[]>(
    `${eccMemberRegistrationsTable}?id=eq.${encodeURIComponent(
      input.id
    )}&select=${eccMemberRegistrationColumns}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        admin_note: cleanText(input.adminNote, 1200),
        official_member: paymentConfirmed,
        official_member_approved_at: paymentConfirmed ? now : null,
        official_member_approved_by: paymentConfirmed ? input.adminEmail : "",
        payment_confirmed: paymentConfirmed,
        payment_confirmed_at: paymentConfirmed ? now : null,
        payment_confirmed_by: paymentConfirmed ? input.adminEmail : "",
        status: paymentConfirmed ? "approved" : "payment_pending",
        updated_at: now
      })
    }
  );

  return rows[0] ? toEccMemberRegistration(rows[0]) : null;
}
