import { siuApplicants, mutateApplication, siuEndpoint } from "@/lib/siu/server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { const { id } = await context.params; return siuEndpoint(request, (access, params) => siuApplicants(id, access, params)); }
export async function POST(request: Request, context: Context) { const { id } = await context.params; return siuEndpoint(request, (access) => mutateApplication(request, access, id)); }
