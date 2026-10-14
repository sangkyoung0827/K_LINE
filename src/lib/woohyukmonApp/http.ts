import { NextResponse } from "next/server";
import { AppError } from "./model";
import { SupabaseRequestError } from "@/lib/supabaseServer";

export function respond(request: Request, data: unknown, status = 200) {
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  const origin = request.headers.get("origin");
  const allowed =
    process.env.NODE_ENV !== "production"
      ? process.env.WOOHYUKMON_APP_WEB_ORIGIN
      : undefined;
  if (allowed && origin === allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  }
  return NextResponse.json(data, { status, headers });
}
export function errorResponse(request: Request, error: unknown) {
  if (error instanceof AppError)
    return respond(request, { error: error.code }, error.status);
  if (error instanceof SupabaseRequestError) {
    let message = "";
    try {
      message = JSON.parse(error.message).message || "";
    } catch {
      /* Do not expose database bodies. */
    }
    const known = [
      "FORBIDDEN",
      "NOT_FOUND",
      "ALREADY_APPLIED",
      "APPLICATION_CLOSED",
      "CAPACITY_FULL",
      "ANSWER_REQUIRED",
      "INVALID_ANSWER",
      "INVALID_CHOICE",
      "ATTENDANCE_REQUIRED",
      "MEMORIES_NOT_OPEN",
      "CONSENT_REQUIRED",
      "REVISION_CONFLICT",
      "FORM_HAS_RESPONSES",
      "CAPACITY_BELOW_APPLICATIONS",
      "INVALID_TRANSITION",
      "EVENT_NOT_FINISHED",
      "EVENT_NOT_STARTED",
      "APPROVAL_REQUIRED",
      "EVENT_IMMUTABLE",
      "APPLICATION_IMMUTABLE",
      "DELETION_PENDING",
      "INVALID_LOGIN_CODE",
    ];
    if (known.includes(message))
      return respond(
        request,
        { error: message },
        message === "FORBIDDEN" ? 403 : message === "NOT_FOUND" ? 404 : 409,
      );
  }
  console.error("Woohyukmon app request failed", {
    type: error instanceof Error ? error.constructor.name : "unknown",
  });
  return respond(request, { error: "SERVICE_UNAVAILABLE" }, 503);
}
