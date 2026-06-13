import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminAccess } from "@/lib/admin";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const access = await getAdminAccess(email);

  return NextResponse.json({
    email,
    isLoggedIn: Boolean(session?.user),
    isDeveloper: access.isDeveloper,
    isSuperAdmin: access.isSuperAdmin,
    role: access.role
  });
}
