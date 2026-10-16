import { NextResponse } from "next/server";
import { assertClubAccess, getGoogleFormsAccess, GoogleFormsAuthorizationError } from "@/lib/googleForms/access";
import { registryColumns, setGoogleFormStatus } from "@/lib/googleForms/googleApi";
import { type GoogleFormRegistryRow, type GoogleFormStatus } from "@/lib/googleForms/types";
import { supabaseRequest } from "@/lib/googleForms/store";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    const access = await getGoogleFormsAccess();
    if (!access.authenticated) throw new GoogleFormsAuthorizationError("LOGIN_REQUIRED", 401);
    if (!access.manageableClubs.length || access.isReadOnly) throw new GoogleFormsAuthorizationError("FORBIDDEN", 403);
    const origin = request.headers.get("origin");
    if (origin !== new URL(request.url).origin) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    const body = await request.json();
    if (body?.confirmedEnded !== true) return NextResponse.json({ error: "EVENT_END_CONFIRMATION_REQUIRED" }, { status: 400 });
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?id=eq.${id}&club_key=in.(${access.manageableClubs.join(",")})&select=${registryColumns}&limit=1`);
    if (!rows[0]) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const form = rows[0];
    assertClubAccess(access, form.club_key, true);
    if (form.status === "archived") return NextResponse.json({ deleted: true });
    const running = await supabaseRequest<{ id: string }[]>(`event_studio_jobs?form_registry_id=eq.${id}&state=eq.running&select=id&limit=1`);
    if (running.length) return NextResponse.json({ error: "EVENT_OPERATION_RUNNING" }, { status: 409 });
    // Remove only the K_LINE entry. Google originals and historical responses remain intact.
    const updated = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?id=eq.${id}&updated_at=eq.${encodeURIComponent(form.updated_at)}&status=eq.${form.status}&select=${registryColumns}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "archived", metadata: { ...form.metadata, endedAt: new Date().toISOString(), deletedBy: access.email } }),
    });
    if (!updated[0]) return NextResponse.json({ error: "EVENT_CHANGED_REFRESH_REQUIRED" }, { status: 409 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof GoogleFormsAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    console.error("Event removal failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "EVENT_DELETE_FAILED" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const access = await getGoogleFormsAccess();
    if (!access.authenticated) throw new GoogleFormsAuthorizationError("LOGIN_REQUIRED", 401);
    if (!access.manageableClubs.length || access.isReadOnly) throw new GoogleFormsAuthorizationError("FORBIDDEN", 403);
    if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&id=eq.${encodeURIComponent(id)}&limit=1`, { cache: "no-store" });
    if (!rows[0]) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    assertClubAccess(access, rows[0].club_key, true);
    const body = await request.json() as { status?: GoogleFormStatus; confirmedInternalTest?: boolean };
    const status = body.status;
    if (!status || !["open", "closed", "archived"].includes(status)) return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    return NextResponse.json({ form: await setGoogleFormStatus(rows[0], status, access.canConnect && body.confirmedInternalTest === true) });
  } catch (error) {
    if (error instanceof GoogleFormsAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Google Form status update failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Forms 연결에 문제가 있습니다." }, { status: 500 });
  }
}
