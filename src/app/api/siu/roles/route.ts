import { siuRoleList, mutateRole, siuEndpoint } from "@/lib/siu/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return siuEndpoint(request, siuRoleList); }
export function PATCH(request: Request) { return siuEndpoint(request, (access) => mutateRole(request, access)); }
