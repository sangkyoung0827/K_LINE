import { handleHanhwalResource } from "@/lib/hanhwalResources/server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; action: string }> };
export async function GET(request: Request, context: Context) {
  const { id, action } = await context.params;
  return handleHanhwalResource(request, [id,action]);
}
export const POST = GET;
