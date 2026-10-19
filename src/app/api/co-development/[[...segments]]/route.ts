import { LabError, labPreviewCsp, labPreviewHtml } from "@/lib/coDevelopment/model";
import { labActor, labCommand, labPreview } from "@/lib/coDevelopment/server";
import { labActionSchema } from "@/lib/coDevelopment/schema";
import { labMcp } from "@/lib/coDevelopment/mcp";
import { labStarter } from "@/lib/coDevelopment/starter";
import JSZip from "jszip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ segments?: string[] }> };
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Vary": "Cookie, Authorization, Origin" };

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new LabError("INVALID_BODY");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 2097152) { await reader.cancel(); throw new LabError("BODY_TOO_LARGE", 413); }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new LabError("INVALID_BODY"); }
}

async function handle(request: Request, context: Context) {
  try {
    const path = (await context.params).segments || [];
    const isActions = path.length === 1 && path[0] === "actions";
    const isMcp = path.length === 1 && path[0] === "mcp";
    const actor = await labActor(request, !(isActions || isMcp));
    if ((isActions || isMcp) && actor.via !== "token") throw new LabError("LAB_FORBIDDEN", 403);
    if (isMcp) {
      if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) throw new LabError("INVALID_ORIGIN", 403);
      const response = await labMcp(request, actor);
      for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
      return response;
    }
    if (request.method === "GET" && path.length === 1 && path[0] === "schema") {
      return Response.json(labActionSchema(new URL(request.url).origin), { headers: privateHeaders });
    }
    if (request.method === "GET" && path.length === 1 && path[0] === "starter") {
      const zip = new JSZip();
      for (const [name, content] of Object.entries(labStarter(new URL(request.url).origin))) zip.file(name, content);
      const bytes = await zip.generateAsync({ type: "uint8array" });
      return new Response(Uint8Array.from(bytes).buffer, { headers: { ...privateHeaders, "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="yuki-codex-lab.zip"' } });
    }
    if (request.method === "GET" && path.length === 1 && path[0] === "card") {
      const settings = await labCommand(actor, { action: "settings_get" }) as { appearance: { cardHtml: string } };
      return new Response(settings.appearance.cardHtml, { headers: {
        ...privateHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": labPreviewCsp,
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()", "X-Frame-Options": "SAMEORIGIN"
      } });
    }
    if (request.method === "GET" && path.length === 2 && path[0] === "preview") {
      const revision = await labPreview(actor, path[1]);
      return new Response(labPreviewHtml(revision.html), { headers: {
        ...privateHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": labPreviewCsp,
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        "X-Frame-Options": "SAMEORIGIN"
      } });
    }
    if (request.method === "GET" && path.length === 0) return Response.json(await labCommand(actor, { action: "list" }), { headers: privateHeaders });
    if (request.method !== "POST" || (path.length && !isActions)) throw new LabError("NOT_FOUND", 404);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new LabError("INVALID_BODY");
    const body = await readBody(request);
    if (isActions && !["list", "get", "save", "settings_get", "settings_save"].includes(String(body.action))) throw new LabError("LAB_FORBIDDEN", 403);
    return Response.json(await labCommand(actor, body), { headers: privateHeaders });
  } catch (error) {
    const known = error instanceof LabError;
    return Response.json({ error: known ? error.code : "LAB_UNAVAILABLE" }, { status: known ? error.status : 503, headers: privateHeaders });
  }
}
export const GET = handle;
export const POST = handle;
