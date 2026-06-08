import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSuperAdminEmail } from "@/lib/admin";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  return NextResponse.json({
    email,
    isLoggedIn: Boolean(session?.user),
    isSuperAdmin: isSuperAdminEmail(email)
  });
}
