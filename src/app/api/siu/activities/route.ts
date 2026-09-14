import { listSiuActivities, mutateActivity, siuEndpoint } from "@/lib/siu/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode");
  return siuEndpoint(request, (access, params) => listSiuActivities(params, access), !["admin", "created"].includes(mode || ""));
}
export function POST(request: Request) { return siuEndpoint(request, (access) => mutateActivity(request, access, null)); }
