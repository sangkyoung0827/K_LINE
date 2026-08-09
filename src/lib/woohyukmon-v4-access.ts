import "server-only";

import { auth } from "@/auth";
import { getAdminAccess } from "@/lib/admin";

export type WoohyukmonV4Access = {
  email: string;
  isAuthenticated: boolean;
  isDeveloper: boolean;
};

export async function getWoohyukmonV4Access(): Promise<WoohyukmonV4Access> {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";

  if (!session?.user || !email) {
    return { email: "", isAuthenticated: false, isDeveloper: false };
  }

  const access = await getAdminAccess(email);

  return {
    email,
    isAuthenticated: true,
    isDeveloper: access.isDeveloper
  };
}

