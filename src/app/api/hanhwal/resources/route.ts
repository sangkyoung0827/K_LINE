import { handleHanhwalResource } from "@/lib/hanhwalResources/server";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => handleHanhwalResource(request);
export const POST = GET;
