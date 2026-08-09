import "server-only";

import { NextResponse } from "next/server";
import { getWoohyukmonV4Access } from "@/lib/woohyukmon-v4-access";

export async function requireWoohyukmonV4DeveloperApi() {
  const access = await getWoohyukmonV4Access();

  if (!access.isAuthenticated) {
    return NextResponse.json({ error: "Developer authentication is required." }, { status: 401 });
  }

  if (!access.isDeveloper) {
    return NextResponse.json({ error: "Developer access is required for WooHyukmon 4.0." }, { status: 403 });
  }

  return access;
}

