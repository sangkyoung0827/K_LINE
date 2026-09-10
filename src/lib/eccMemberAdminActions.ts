import "server-only";

import {
  approveEccOfficialMember,
  revokeEccOfficialMember
} from "@/lib/eccAccess";
import {
  patchEccMemberRegistrationWithChangeInfo
} from "@/lib/eccMemberRegistrations";

export async function applyEccMemberAdminUpdate(input: {
  adminEmail: string;
  adminNote: string;
  id: string;
  paymentConfirmed: boolean;
}) {
  const result = await patchEccMemberRegistrationWithChangeInfo(input);
  const registration = result.registration;

  if (!registration) {
    return result;
  }

  // A previous attempt may have saved the registration before the role write
  // failed. An identical retry must finish that write instead of reporting success.
  if (result.paymentConfirmedChanged || !result.changed) {
    if (registration.paymentConfirmed) {
      await approveEccOfficialMember({
        approvedBy: input.adminEmail,
        avatarUrl: registration.googleAvatarUrl,
        email: registration.googleEmail,
        name: registration.googleName || registration.fullName
      });
    } else {
      await revokeEccOfficialMember({
        email: registration.googleEmail,
        revokedBy: input.adminEmail
      });
    }
  }

  return { ...result, changed: true };
}
