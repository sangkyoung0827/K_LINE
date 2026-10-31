import { labOAuthMetadata } from "@/lib/coDevelopment/oauth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return labOAuthMetadata(request); }
