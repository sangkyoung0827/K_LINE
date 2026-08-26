import { NextResponse } from "next/server";
import { toJejuApiError } from "@/lib/jeju/service";

export function jejuErrorResponse(error: unknown) {
  const safeError = toJejuApiError(error);
  return NextResponse.json(
    {
      error: safeError.message,
      debugCode: safeError.code
    },
    { status: safeError.status }
  );
}

export function jejuAdminDenied(isLoggedIn: boolean) {
  return NextResponse.json(
    { error: "Jeju administrator access is required.", debugCode: "JEJU_ADMIN_REQUIRED" },
    { status: isLoggedIn ? 403 : 401 }
  );
}
