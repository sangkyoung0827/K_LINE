import { retrySiu, siuEndpoint } from "@/lib/siu/server";
export const dynamic = "force-dynamic";
export function POST(request: Request) { return siuEndpoint(request, retrySiu); }
