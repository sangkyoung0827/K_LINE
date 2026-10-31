import { labOAuthMetadata } from "@/lib/coDevelopment/oauth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ segments?: string[] }> }) {
  const path = (await context.params).segments || [];
  if (path.length && path.join("/") !== "api/co-development/mcp") return Response.json({ error: "not_found" }, { status: 404 });
  return labOAuthMetadata(request, true);
}
