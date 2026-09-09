import "server-only";

import { isDeveloperEmail, normalizeEmail } from "@/lib/admin";
import { supabaseRequest } from "@/lib/supabaseServer";

export async function resetHanhwalMemberRegistrationData(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("An HANHWAL member email is required for reset.");
  }

  if (isDeveloperEmail(normalizedEmail)) {
    throw new Error("Developer HANHWAL membership data cannot be reset from member management.");
  }

  // One transaction; never fall back to a partially completed reset.
  await supabaseRequest<null>("rpc/reset_hanhwal_member_registration", {
    method: "POST",
    body: JSON.stringify({ target_email: normalizedEmail })
  });

  return {
    resetTables: ["Hanhwal member registrations", "Hanhwal roles"],
    email: normalizedEmail
  };
}
