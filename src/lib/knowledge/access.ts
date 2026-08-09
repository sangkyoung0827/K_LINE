import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminAccess, normalizeEmail } from "@/lib/admin";

export async function getKnowledgeDeveloper() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  const access = await getAdminAccess(email);

  return {
    email,
    isAuthenticated: Boolean(session?.user && email),
    isDeveloper: access.isDeveloper
  };
}

export async function requireKnowledgeDeveloperApi() {
  const access = await getKnowledgeDeveloper();

  if (!access.isAuthenticated) {
    return {
      access,
      response: NextResponse.json(
        { error: "Google login is required.", debugCode: "KNOWLEDGE_LOGIN_REQUIRED" },
        { status: 401 }
      )
    };
  }

  if (!access.isDeveloper) {
    return {
      access,
      response: NextResponse.json(
        { error: "Developer access is required.", debugCode: "KNOWLEDGE_FORBIDDEN" },
        { status: 403 }
      )
    };
  }

  return { access, response: null };
}
