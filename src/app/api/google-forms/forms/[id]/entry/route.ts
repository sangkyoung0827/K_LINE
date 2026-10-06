import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { normalizeEmail } from "@/lib/admin";
import {
  getEccEntryForm, lookupEccFormEligibility, grantEccFormResponder,
  eccFormEntryCookie, eccFormEntryLifetime, issueEccFormEntry, readEccFormEntry,
} from "@/lib/googleForms/eccResponderEntry";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function entryContext(context: Context) {
  const email = normalizeEmail((await auth())?.user?.email);
  if (!email) throw new Error("LOGIN_REQUIRED");
  const { id } = await context.params;
  const form = await getEccEntryForm(id);
  const eligibility = await lookupEccFormEligibility(email);
  return { email, form, eligibility };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "ENTRY_UNAVAILABLE";
  if (message === "LOGIN_REQUIRED") return reply({ state: "login" }, 401);
  if (["FORM_NOT_AVAILABLE", "ECC_FORM_GATE_DISABLED"].includes(message)) return reply({ state: "closed" }, 404);
  // Do not disclose upstream errors, membership rows, permissions or OAuth details.
  return reply({ state: "unavailable", error: "신청 접근을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요." }, 503);
}

export async function GET(_request: Request, context: Context) {
  try {
    const { form, eligibility } = await entryContext(context);
    return reply({ state: eligibility, title: form.title });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, context: Context) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid origin" }, 403);
  try {
    const { email, form, eligibility } = await entryContext(context);
    if (eligibility === "unpaid") return reply({ state: "unpaid" }, 403);
    if (eligibility === "unavailable") return reply({ state: "unavailable" }, 503);
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
    const token = (await cookies()).get(eccFormEntryCookie)?.value;
    const currentExpiry = readEccFormEntry(token, email, form.id, secret);
    let expires: number | undefined;
    if (eligibility === "outage") {
      if (!currentExpiry && (await request.json().catch(() => null))?.paid !== true) return reply({ state: "outage" }, 409);
      if (!secret) throw new Error("TEMPORARY_ENTRY_SECRET_REQUIRED");
      expires = currentExpiry || Math.floor(Date.now() / 1000) * 1000 + eccFormEntryLifetime * 1000;
    }
    const grant = await grantEccFormResponder(form, email, expires);
    const response = reply({ state: expires ? "temporary" : "allowed", url: form.responder_url, expiresAt: grant.expires });
    if (expires !== undefined) {
      if (!grant.expires) throw new Error("TEMPORARY_EXPIRY_REQUIRED");
      response.cookies.set(eccFormEntryCookie, issueEccFormEntry(email, form.id, grant.expires, secret), {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
        path: `/api/google-forms/forms/${form.id}/entry`,
        maxAge: Math.max(0, Math.floor((grant.expires - Date.now()) / 1000)),
      });
    }
    return response;
  } catch (error) { return failure(error); }
}
