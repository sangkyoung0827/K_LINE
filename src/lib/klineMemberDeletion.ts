import "server-only";

import { isDeveloperEmail, normalizeEmail } from "@/lib/admin";
import { SupabaseRequestError, supabaseRequest } from "@/lib/supabaseServer";

type DeletionTarget = {
  label: string;
  path: string;
};

async function deleteIfAvailable(target: DeletionTarget) {
  try {
    await supabaseRequest<null>(target.path, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });

    return target.label;
  } catch (error) {
    // Some optional K_LINE modules may not have been installed in an older database.
    if (error instanceof SupabaseRequestError && error.status === 404) {
      return "";
    }

    throw error;
  }
}

export async function deleteKLineMemberData(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("A member email is required for deletion.");
  }

  if (isDeveloperEmail(normalizedEmail)) {
    throw new Error("Developer account data cannot be deleted from member management.");
  }

  const encodedEmail = encodeURIComponent(normalizedEmail);
  const targets: DeletionTarget[] = [
    // Deleting projects cascades to the member's saved chats, messages, and feedback.
    { label: "WooHyukmon history", path: `woohyukmon_projects?user_id=eq.${encodedEmail}` },
    { label: "WooHyukmon action history", path: `woohyukmon_action_audit?user_email=eq.${encodedEmail}` },
    { label: "ECC board posts", path: `club_board_posts?author_email=eq.${encodedEmail}` },
    { label: "Hanhwal board posts", path: `hanhwal_board_posts?author_email=eq.${encodedEmail}` },
    {
      label: "member registration campaign records",
      path: `member_registration_applicant_statuses?applicant_email=eq.${encodedEmail}`
    },
    { label: "ECC alumni inquiries", path: `ecc_alumni_activity_inquiries?email=eq.${encodedEmail}` },
    { label: "ECC rejoin requests", path: `ecc_rejoin_requests?google_email=eq.${encodedEmail}` },
    { label: "ECC membership history", path: `ecc_membership_history?email=eq.${encodedEmail}` },
    { label: "admin role requests", path: `admin_role_requests?email=eq.${encodedEmail}` },
    { label: "admin roles", path: `admin_roles?email=eq.${encodedEmail}` },
    {
      label: "Hanhwal member registrations",
      path: `hanhwal_member_registrations?google_email=eq.${encodedEmail}`
    },
    { label: "Hanhwal roles", path: `hanhwal_roles?email=eq.${encodedEmail}` },
    {
      label: "ECC member registrations",
      path: `ecc_member_registrations?google_email=eq.${encodedEmail}`
    },
    { label: "ECC roles", path: `ecc_roles?email=eq.${encodedEmail}` },
    { label: "site visits", path: `site_visits?user_email=eq.${encodedEmail}` },
    { label: "site visitor records", path: `site_visitors?user_email=eq.${encodedEmail}` },
    { label: "site member profile", path: `site_members?email=eq.${encodedEmail}` }
  ];

  const deletedTables: string[] = [];

  for (const target of targets) {
    const deleted = await deleteIfAvailable(target);

    if (deleted) {
      deletedTables.push(deleted);
    }
  }

  return {
    deletedTables,
    email: normalizedEmail
  };
}
