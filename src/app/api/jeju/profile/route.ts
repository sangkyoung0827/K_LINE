import { NextResponse } from "next/server";
import { jejuErrorResponse } from "@/lib/jeju/http";
import { getCurrentJejuUser, getJejuProfile, saveJejuProfile } from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentJejuUser();
    return NextResponse.json({ profile: await getJejuProfile(user.email), user: { email: user.email, name: user.name } });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}

async function save(request: Request) {
  try {
    const user = await getCurrentJejuUser();
    const body = (await request.json()) as Record<string, unknown>;
    const profile = await saveJejuProfile({ body, email: user.email, name: user.name });
    return NextResponse.json({ profile });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}

export const POST = save;
export const PUT = save;
