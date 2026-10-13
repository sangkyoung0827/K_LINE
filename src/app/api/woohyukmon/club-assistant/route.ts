import { getClubAssistantAccess } from "@/lib/woohyukmon/club-access";
import { clubAssistantReply, ClubAssistantError } from "@/lib/woohyukmon/club-service";

export const dynamic = "force-dynamic";
export const maxDuration = 180;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function GET() { return Response.json(await getClubAssistantAccess(), { headers }); }
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new ClubAssistantError("Invalid origin.", 403);
    const raw = await request.text();
    if (raw.length > 60000) throw new ClubAssistantError("Request too large.", 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ClubAssistantError("Invalid request.");
    return Response.json(await clubAssistantReply(await getClubAssistantAccess(), request, body), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ClubAssistantError ? error.message : "우혁몬 운영 연결에 문제가 있습니다. 다시 시도해 주세요." }, { status: error instanceof ClubAssistantError ? error.status : 503, headers });
  }
}
