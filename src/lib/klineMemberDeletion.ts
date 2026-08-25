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

export async function resetEccMemberRegistrationData(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("An ECC member email is required for reset.");
  }

  if (isDeveloperEmail(normalizedEmail)) {
    throw new Error("Developer ECC membership data cannot be reset from member management.");
  }

  const encodedEmail = encodeURIComponent(normalizedEmail);
  const targets: DeletionTarget[] = [
    // Keep this list strictly scoped to ECC registration and ECC permission state.
    // Global K_LINE account and role records stay intact, as do Hanhwal data, posts,
    // chats, analytics, and every other service area.
    {
      label: "ECC member registrations",
      path: `ecc_member_registrations?google_email=eq.${encodedEmail}`
    },
    { label: "ECC roles", path: `ecc_roles?email=eq.${encodedEmail}` }
  ];

  const resetTables: string[] = [];

  for (const target of targets) {
    const deleted = await deleteIfAvailable(target);

    if (deleted) {
      resetTables.push(deleted);
    }
  }

  return {
    resetTables,
    email: normalizedEmail
  };
}
