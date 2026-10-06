import {
  appDB,
  digest,
  jsonInput,
  memberBy,
  requireAppEnabled,
  secret,
} from "@/lib/woohyukmonApp/server";
import { AppError } from "@/lib/woohyukmonApp/model";
import { errorResponse, respond } from "@/lib/woohyukmonApp/http";
export const dynamic = "force-dynamic";
export async function OPTIONS(request: Request) {
  return respond(request, {});
}
export async function POST(request: Request) {
  try {
    requireAppEnabled();
    const data = await jsonInput(request);
    if (
      typeof data.code !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(data.code) ||
      typeof data.verifier !== "string" ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(data.verifier)
    )
      throw new AppError("INVALID_LOGIN_REQUEST");
    const token = secret();
    const id = await appDB<string>("rpc/woo_v1_exchange_grant", {
      method: "POST",
      body: JSON.stringify({
        p_code_hash: digest(data.code),
        p_challenge: digest(data.verifier),
        p_token_hash: digest(token),
      }),
    });
    const actor = await memberBy("id", id);
    return respond(request, {
      token,
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      user: { id: actor.id, name: actor.name },
    });
  } catch (error) {
    return errorResponse(request, error);
  }
}
