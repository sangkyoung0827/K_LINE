import { getClubAssistantAccess } from "@/lib/woohyukmon/club-access";
import { clubAssistantReply, ClubAssistantError } from "@/lib/woohyukmon/club-service";
import { OpenAIGenerationError } from "@/lib/woohyukmon/generation";

export const dynamic = "force-dynamic";
export const maxDuration = 180;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function GET() { return Response.json(await getClubAssistantAccess(), { headers }); }
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new ClubAssistantError("Invalid origin.", 403);
    const raw = await request.text();
    if (raw.length > 120000) throw new ClubAssistantError("Request too large.", 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ClubAssistantError("Invalid request.");
    return Response.json(await clubAssistantReply(await getClubAssistantAccess(), request, body), { headers });
  } catch (error) {
    const diagnosticCode = error instanceof OpenAIGenerationError || error instanceof ClubAssistantError ? error.code : undefined;
    // Never log prompts, response bodies, member data, cookies or credentials.
    if (diagnosticCode) console.warn("Woohyukmon plan response failed", { code: diagnosticCode, ...(error instanceof OpenAIGenerationError ? { model: error.model } : {}) });
    return Response.json({ error: error instanceof ClubAssistantError || error instanceof OpenAIGenerationError ? error.message : "우혁몬 운영 연결에 문제가 있습니다. 다시 시도해 주세요.", ...(diagnosticCode ? { diagnosticCode } : {}) }, { status: error instanceof ClubAssistantError ? error.status : error instanceof OpenAIGenerationError ? 502 : 503, headers });
  }
}
