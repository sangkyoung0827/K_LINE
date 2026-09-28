import type { EccRoleRow } from "@/lib/eccAccess";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function hasEccMembershipHistory(row: EccRoleRow) {
  return Boolean(
    row.payment_confirmed ||
      row.is_official_member ||
      (row.official_member_status && row.official_member_status !== "none") ||
      (row.admin_status && row.admin_status !== "none") ||
      (row.super_admin_status && row.super_admin_status !== "none") ||
      (row.role && row.role !== "user")
  );
}

export function getEccPermissionEmails(
  registrations: Array<{ google_email: string }>,
  roles: EccRoleRow[]
) {
  const emails = new Set<string>();

  registrations.forEach((registration) => emails.add(normalizeEmail(registration.google_email)));
  roles.filter(hasEccMembershipHistory).forEach((role) => emails.add(normalizeEmail(role.email)));

  return Array.from(emails).filter(Boolean).sort();
}
