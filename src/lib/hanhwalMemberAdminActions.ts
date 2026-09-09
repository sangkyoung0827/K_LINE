import "server-only";

import {
  approveHanhwalOfficialMember,
  revokeHanhwalOfficialMember
} from "@/lib/hanhwalAccess";
import {
  patchHanhwalMemberRegistrationWithChangeInfo
} from "@/lib/hanhwalMemberRegistrations";

export async function applyHanhwalMemberAdminUpdate(input: {
  adminEmail: string;
  adminNote: string;
  id: string;
  paymentConfirmed: boolean;
}) {
  const result = await patchHanhwalMemberRegistrationWithChangeInfo(input);
  const registration = result.registration;

  if (!registration || !result.changed) {
    return result;
  }

  if (result.paymentConfirmedChanged) {
    if (registration.paymentConfirmed) {
      await approveHanhwalOfficialMember({
        approvedBy: input.adminEmail,
        avatarUrl: registration.googleAvatarUrl,
        email: registration.googleEmail,
        name: registration.googleName || registration.fullName
      });
    } else {
      await revokeHanhwalOfficialMember({
        email: registration.googleEmail,
        revokedBy: input.adminEmail
      });
    }
  }

  return result;
}
