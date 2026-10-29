import "server-only";

import {
  approveHanhwalOfficialMember,
  hanhwalRoleColumns,
  hanhwalRolesTable,
  revokeHanhwalOfficialMember,
  type HanhwalRoleRow
} from "@/lib/hanhwalAccess";
import {
  hanhwalMemberRegistrationColumns,
  hanhwalMemberRegistrationsTable,
  toHanhwalMemberRegistration,
  type HanhwalMemberRegistrationRow
} from "@/lib/hanhwalMemberRegistrations";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";

export async function applyHanhwalMemberAdminUpdate(input: {
  adminEmail: string;
  adminNote?: string;
  id: string;
  paymentConfirmed?: boolean;
}) {
  const existingRows = await supabaseRequest<HanhwalMemberRegistrationRow[]>(
    `${hanhwalMemberRegistrationsTable}?id=eq.${encodeURIComponent(input.id)}&select=${hanhwalMemberRegistrationColumns}&limit=1`
  );
  const existing = existingRows[0] ? toHanhwalMemberRegistration(existingRows[0]) : null;
  if (!existing) return { changed: false, registration: null };

  const adminNote = input.adminNote === undefined ? existing.adminNote : cleanText(input.adminNote, 1200);
  const paymentConfirmed = input.paymentConfirmed ?? existing.paymentConfirmed;
  const noteChanged = adminNote !== existing.adminNote;
  const paymentChanged = input.paymentConfirmed !== undefined && (
    paymentConfirmed !== existing.paymentConfirmed || paymentConfirmed !== existing.officialMember
  );
  if (!noteChanged && !paymentChanged) return { changed: false, registration: existing };

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { updated_at: now };
  if (noteChanged) payload.admin_note = adminNote;
  if (paymentChanged) {
    Object.assign(payload, {
      official_member: paymentConfirmed,
      official_member_approved_at: paymentConfirmed ? now : null,
      official_member_approved_by: paymentConfirmed ? input.adminEmail : "",
      payment_confirmed: paymentConfirmed,
      payment_confirmed_at: paymentConfirmed ? now : null,
      payment_confirmed_by: paymentConfirmed ? input.adminEmail : "",
      status: paymentConfirmed ? "approved" : "payment_pending"
    });

    // Keep the registration pending on permission failure. If the later
    // registration write fails, a retry skips the already-completed role write.
    const roles = await supabaseRequest<HanhwalRoleRow[]>(
      `${hanhwalRolesTable}?select=${hanhwalRoleColumns}&email=eq.${encodeURIComponent(existing.googleEmail)}&limit=1`
    );
    const role = roles[0];
    const roleMatches = paymentConfirmed
      ? Boolean(role?.is_official_member && role.payment_confirmed && role.official_member_status === "approved")
      : !role?.is_official_member && !role?.payment_confirmed && role?.official_member_status !== "approved";
    if (!roleMatches) {
      if (paymentConfirmed) {
        await approveHanhwalOfficialMember({
          approvedBy: input.adminEmail,
          avatarUrl: existing.googleAvatarUrl,
          email: existing.googleEmail,
          name: existing.googleName || existing.fullName
        });
      } else {
        await revokeHanhwalOfficialMember({ email: existing.googleEmail, revokedBy: input.adminEmail });
      }
    }
  }
  const rows = await supabaseRequest<HanhwalMemberRegistrationRow[]>(
    `${hanhwalMemberRegistrationsTable}?id=eq.${encodeURIComponent(input.id)}&select=${hanhwalMemberRegistrationColumns}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload)
    }
  );
  if (!rows[0]) throw new Error("Hanhwal member registration update was not saved.");
  return { changed: true, registration: toHanhwalMemberRegistration(rows[0]) };
}
