import { siuEndpoint } from "@/lib/siu/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return siuEndpoint(request, async (access) => ({ access })); }
