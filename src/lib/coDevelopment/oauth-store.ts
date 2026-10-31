import "server-only";
import { createHash } from "node:crypto";
import { getSupabaseConfig } from "@/lib/supabaseServer";

export const labOAuthScope = "lab:develop";
export const oauthHash = (value: string) => createHash("sha256").update(value).digest("hex");
export class LabOAuthError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function labOAuthOrigin(request: Request) {
  const incoming = new URL(request.url).origin;
  const configured = process.env.CO_DEVELOPMENT_OAUTH_ORIGIN;
  const origin = configured || (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(incoming)
    ? incoming : "https://kline-nine-wheat.vercel.app");
  const url = new URL(origin);
  if (url.origin !== origin || url.username || url.password || (url.protocol !== "https:" && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))
    throw new LabOAuthError("server_error", 503);
  if (incoming !== origin) throw new LabOAuthError("invalid_target");
  return origin;
}
export const labOAuthResource = (origin: string) => `${origin}/api/co-development/mcp`;
export const labOAuthHeaders = {
  "Cache-Control": "private, no-store", "Pragma": "no-cache", "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff", "Vary": "Cookie, Authorization, Origin"
};
const operations = new Set(["limit", "client_get", "client_save", "request_save", "request_get", "decide", "exchange", "refresh", "verify", "revoke_token", "connections", "disconnect"]);
export async function labOAuthStore<T>(op: string, data: Record<string, unknown>): Promise<T> {
  if (!operations.has(op)) throw new LabOAuthError("invalid_request");
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/co_dev_oauth`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_op: op, p_data: data })
  });
  if (!response.ok) throw new LabOAuthError("temporarily_unavailable", 503);
  return response.json() as Promise<T>;
}
export async function labOAuthVerify(request: Request, token: string) {
  const issuer = labOAuthOrigin(request);
  if (!/^kla_[a-f0-9]{64}$/.test(token)) throw new LabOAuthError("invalid_token", 401);
  const result = await labOAuthStore<{ email: string } | null>("verify", { hash: oauthHash(token), issuer, resource: labOAuthResource(issuer) });
  if (!result) throw new LabOAuthError("invalid_token", 401);
  return result;
}
export function labOAuthChallenge(request: Request) {
  const issuer = labOAuthOrigin(request);
  return `Bearer resource_metadata="${issuer}/.well-known/oauth-protected-resource/api/co-development/mcp", scope="${labOAuthScope}"`;
}
