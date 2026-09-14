import { siuDetail, mutateActivity, siuEndpoint } from "@/lib/siu/server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { const { id } = await context.params; return siuEndpoint(request, (access) => siuDetail(id, access)); }
export async function PATCH(request: Request, context: Context) { const { id } = await context.params; return siuEndpoint(request, (access) => mutateActivity(request, access, id)); }
