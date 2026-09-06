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

  if (!registration || !result.changed) {
    return result;
  }

  if (result.paymentConfirmedChanged) {
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

  return result;
}
