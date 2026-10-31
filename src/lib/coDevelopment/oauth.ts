import "server-only";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { OAuthClientMetadataSchema, OAuthMetadataSchema, OAuthProtectedResourceMetadataSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import { labActor } from "./server";
import { labId, LabError } from "./model";
import { labOAuthHeaders, labOAuthOrigin, labOAuthResource, labOAuthScope, LabOAuthError, labOAuthStore, oauthHash } from "./oauth-store";

const basePath = "/api/co-development/oauth";
type Client = { id: string; metadata: { client_name: string; redirect_uris: string[]; token_endpoint_auth_method: string }; secret_hash: string | null };
type Consent = { clientName: string; redirectUri: string; scope: string };
const opaque = (prefix: string) => `${prefix}_${randomBytes(32).toString("hex")}`;
const json = (data: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(data, { status, headers: { ...labOAuthHeaders, ...extra } });
const validCallback = (value: string) => {
  try {
    const u = new URL(value);
    return u.origin === "https://chatgpt.com" && !u.search && !u.hash && !u.username && !u.password &&
      (u.pathname === "/connector_platform_oauth_redirect" || /^\/connector\/oauth\/[A-Za-z0-9_-]{1,200}$/.test(u.pathname));
  } catch { return false; }
};
const cimd = (id: string) => /^https:\/\/chatgpt\.com\/oauth\/(?:[A-Za-z0-9_-]{1,200}\/)?client\.json$/.test(id);
function parameter(params: URLSearchParams, name: string, required = true) {
  const values = params.getAll(name);
  if (values.length > 1 || (required && !values[0]) || (values[0]?.length || 0) > 2048) throw new LabOAuthError("invalid_request");
  return values[0] || "";
}
async function body(request: Request, type: "form" | "json") {
  if (!request.headers.get("content-type")?.startsWith(type === "form" ? "application/x-www-form-urlencoded" : "application/json")) throw new LabOAuthError("invalid_request");
  const reader = request.body?.getReader();
  if (!reader) throw new LabOAuthError("invalid_request");
  const parts: Uint8Array[] = []; let length = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    length += next.value.length;
    if (length > 16384) { await reader.cancel(); throw new LabOAuthError("invalid_request", 413); }
    parts.push(next.value);
  }
  const text = Buffer.concat(parts).toString("utf8");
  try {
    if (type === "form") return new URLSearchParams(text);
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as unknown;
  }
  catch { throw new LabOAuthError("invalid_request"); }
}
async function rate(key: string, max: number) {
  if (!await labOAuthStore<boolean>("limit", { key: oauthHash(key), max })) throw new LabOAuthError("temporarily_unavailable", 429);
}
async function client(id: string, issuer: string): Promise<Client> {
  if (cimd(id)) {
    // Only OpenAI's fixed HTTPS origin is fetched. No redirects, arbitrary hosts or user-supplied JWKS.
    const response = await fetch(id, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new LabOAuthError("invalid_client", 401);
    const reader = response.body?.getReader(); if (!reader) throw new LabOAuthError("invalid_client", 401);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length; if (length > 16384) { await reader.cancel(); throw new LabOAuthError("invalid_client", 401); } chunks.push(part.value); }
    const doc = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const parsed = OAuthClientMetadataSchema.safeParse(doc);
    const methods = doc.token_endpoint_auth_methods_supported || [doc.token_endpoint_auth_method];
    if (!parsed.success || doc.client_id !== id || !Array.isArray(methods) || !methods.includes("none") ||
        parsed.data.redirect_uris.length < 1 || parsed.data.redirect_uris.length > 10 || !parsed.data.redirect_uris.every(validCallback)) throw new LabOAuthError("invalid_client", 401);
    const metadata = { client_name: "ChatGPT", redirect_uris: parsed.data.redirect_uris, token_endpoint_auth_method: "none" };
    await labOAuthStore("client_save", { id, issuer, metadata, secret_hash: null });
    return { id, metadata, secret_hash: null };
  }
  if (!/^klc_[a-f0-9]{64}$/.test(id)) throw new LabOAuthError("invalid_client", 401);
  const found = await labOAuthStore<Client | null>("client_get", { id, issuer });
  if (!found) throw new LabOAuthError("invalid_client", 401);
  return found;
}
async function authenticatedClient(request: Request, params: URLSearchParams, issuer: string) {
  let id = parameter(params, "client_id", false), secret = parameter(params, "client_secret", false), method = secret ? "client_secret_post" : "none";
  const header = request.headers.get("authorization");
  if (header) {
    if (!header.startsWith("Basic ") || secret) throw new LabOAuthError("invalid_client", 401);
    try {
      const raw = Buffer.from(header.slice(6), "base64").toString("utf8"), split = raw.indexOf(":");
      if (split < 1) throw new Error();
      const basicId = decodeURIComponent(raw.slice(0, split));
      if (id && id !== basicId) throw new Error();
      id = basicId; secret = decodeURIComponent(raw.slice(split + 1)); method = "client_secret_basic";
    } catch { throw new LabOAuthError("invalid_client", 401); }
  }
  await rate(`client:${issuer}:${id}`, 240);
  const value = await client(id, issuer);
  if (value.metadata.token_endpoint_auth_method !== method || (method !== "none" &&
      (!value.secret_hash || !timingSafeEqual(Buffer.from(oauthHash(secret)), Buffer.from(value.secret_hash))))) throw new LabOAuthError("invalid_client", 401);
  return value;
}
function nonce(request: Request, id: string) {
  const name = cookieName(request, id);
  const value = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value || !/^[a-f0-9]{64}$/.test(value)) throw new LabOAuthError("invalid_request");
  return oauthHash(value);
}
function cookieName(request: Request, id: string) { return `${new URL(request.url).protocol === "https:" ? "__Host-" : ""}kline-lab-consent-${id}`; }
function consentCookie(request: Request, id: string, value: string, age: number) {
  return `${cookieName(request, id)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function labOAuthMetadata(request: Request, resource = false) {
  try {
  const origin = labOAuthOrigin(request);
  const data = resource ? OAuthProtectedResourceMetadataSchema.parse({
    resource: labOAuthResource(origin), authorization_servers: [origin], scopes_supported: [labOAuthScope], bearer_methods_supported: ["header"],
    resource_name: "K_LINE Developer Studio", resource_documentation: `${origin}/co-development`
  }) : OAuthMetadataSchema.parse({
    issuer: origin, authorization_endpoint: `${origin}${basePath}/authorize`, token_endpoint: `${origin}${basePath}/token`,
    registration_endpoint: `${origin}${basePath}/register`, revocation_endpoint: `${origin}${basePath}/revoke`,
    response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    code_challenge_methods_supported: ["S256"], scopes_supported: [labOAuthScope],
    authorization_response_iss_parameter_supported: true, client_id_metadata_document_supported: true
  });
  return json(data);
  } catch (error) { return json({ error: error instanceof LabOAuthError ? error.code : "server_error" }, error instanceof LabOAuthError ? error.status : 503); }
}
export async function labOAuthHandle(request: Request, endpoint: string) {
  try {
    const issuer = labOAuthOrigin(request);
    if (request.method === "GET" && endpoint === "authorize") {
      await rate(`authorize:${issuer}`, 1000);
      const params = new URL(request.url).searchParams;
      const value = await client(parameter(params, "client_id"), issuer);
      const redirect = parameter(params, "redirect_uri");
      // Never redirect errors to an unregistered URI.
      if (!value.metadata.redirect_uris.includes(redirect) || !validCallback(redirect)) throw new LabOAuthError("invalid_request");
      const state = parameter(params, "state", false);
      try {
        if (parameter(params, "response_type") !== "code") throw new LabOAuthError("unsupported_response_type");
        if (parameter(params, "resource") !== labOAuthResource(issuer)) throw new LabOAuthError("invalid_target");
        const scope = parameter(params, "scope", false) || labOAuthScope;
        if (scope !== labOAuthScope) throw new LabOAuthError("invalid_scope");
        const challenge = parameter(params, "code_challenge");
        if (parameter(params, "code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new LabOAuthError("invalid_request");
        const id = randomUUID(), csrf = randomBytes(32).toString("hex");
        await labOAuthStore("request_save", { id, client_id: value.id, issuer, resource: labOAuthResource(issuer), redirect_uri: redirect, state: state || null, challenge, nonce_hash: oauthHash(csrf) });
        return new Response(null, { status: 303, headers: { ...labOAuthHeaders, Location: `${issuer}/co-development/connect?request=${id}`, "Set-Cookie": consentCookie(request, id, csrf, 600) } });
      } catch (error) {
        if (!(error instanceof LabOAuthError) || error.status >= 500) throw error;
        const url = new URL(redirect); url.searchParams.set("error", error.code); url.searchParams.set("iss", issuer); if (state) url.searchParams.set("state", state);
        return new Response(null, { status: 303, headers: { ...labOAuthHeaders, Location: url.href } });
      }
    }
    if (endpoint === "consent" || endpoint === "connections") {
      const actor = await labActor(request, true);
      if (endpoint === "connections") {
        if (request.method === "GET") return json(await labOAuthStore("connections", { email: actor.email, issuer }));
        if (request.method !== "POST") throw new LabOAuthError("invalid_request");
        const data = await body(request, "json") as Record<string, unknown>;
        await labOAuthStore("disconnect", { id: labId(data.id), email: actor.email, issuer });
        return json({ revoked: true });
      }
      if (request.method === "GET") {
        const id = labId(parameter(new URL(request.url).searchParams, "request"));
        const detail = await labOAuthStore<Consent | null>("request_get", { id, nonce_hash: nonce(request, id), issuer });
        if (!detail) throw new LabOAuthError("invalid_request");
        return json({ ...detail, email: actor.email });
      }
      if (request.method !== "POST") throw new LabOAuthError("invalid_request");
      const data = await body(request, "json") as Record<string, unknown>;
      if (typeof data.approve !== "boolean") throw new LabOAuthError("invalid_request");
      const id = labId(data.request), code = opaque("klcode");
      const result = await labOAuthStore<{ redirect_uri: string; state: string | null } | null>("decide", {
        id, nonce_hash: nonce(request, id), issuer, email: actor.email, approve: data.approve, code_hash: oauthHash(code), grant_id: randomUUID()
      });
      if (!result) throw new LabOAuthError("invalid_request");
      const url = new URL(result.redirect_uri);
      url.searchParams.set(data.approve ? "code" : "error", data.approve ? code : "access_denied");
      url.searchParams.set("iss", issuer); if (result.state) url.searchParams.set("state", result.state);
      return json({ redirect: url.href }, 200, { "Set-Cookie": consentCookie(request, id, "", 0) });
    }
    if (request.method !== "POST") return json({ error: "invalid_request" }, 405, { Allow: "POST" });
    await rate(`endpoint:${issuer}:${endpoint}`, endpoint === "register" ? 200 : 3000);
    if (endpoint === "register") {
      const parsed = OAuthClientMetadataSchema.safeParse(await body(request, "json"));
      if (!parsed.success || parsed.data.redirect_uris.length < 1 || parsed.data.redirect_uris.length > 10 || !parsed.data.redirect_uris.every(validCallback) ||
          parsed.data.grant_types?.some(g => !["authorization_code", "refresh_token"].includes(g)) || parsed.data.response_types?.some(r => r !== "code") ||
          (parsed.data.scope && parsed.data.scope !== labOAuthScope)) throw new LabOAuthError("invalid_client_metadata");
      const method = parsed.data.token_endpoint_auth_method || "client_secret_basic";
      if (!["none", "client_secret_post", "client_secret_basic"].includes(method)) throw new LabOAuthError("invalid_client_metadata");
      const id = opaque("klc"), secret = method === "none" ? null : opaque("klsecret");
      const metadata = { client_name: (parsed.data.client_name || "MCP client").slice(0, 100), redirect_uris: parsed.data.redirect_uris,
        token_endpoint_auth_method: method, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], scope: labOAuthScope };
      await labOAuthStore("client_save", { id, issuer, metadata, secret_hash: secret ? oauthHash(secret) : null });
      return json({ ...metadata, client_id: id, client_id_issued_at: Math.floor(Date.now() / 1000), ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}) }, 201);
    }
    if (!["token", "revoke"].includes(endpoint)) return json({ error: "invalid_request" }, 404);
    const params = await body(request, "form") as URLSearchParams;
    const value = await authenticatedClient(request, params, issuer);
    if (endpoint === "revoke") {
      await labOAuthStore("revoke_token", { hash: oauthHash(parameter(params, "token")), client_id: value.id, issuer });
      return new Response(null, { status: 200, headers: labOAuthHeaders });
    }
    if (parameter(params, "resource") !== labOAuthResource(issuer)) throw new LabOAuthError("invalid_target");
    const grant = parameter(params, "grant_type");
    const access = opaque("kla"), refresh = opaque("klr");
    const args = { client_id: value.id, issuer, resource: labOAuthResource(issuer), access_hash: oauthHash(access), refresh_hash: oauthHash(refresh) };
    let success: boolean;
    if (grant === "authorization_code") {
      const verifier = parameter(params, "code_verifier");
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new LabOAuthError("invalid_grant");
      success = await labOAuthStore("exchange", { ...args, code_hash: oauthHash(parameter(params, "code")),
        redirect_uri: parameter(params, "redirect_uri"), challenge: createHash("sha256").update(verifier).digest("base64url") });
    } else if (grant === "refresh_token") {
      const scope = parameter(params, "scope", false);
      if (scope && scope !== labOAuthScope) throw new LabOAuthError("invalid_scope");
      success = await labOAuthStore("refresh", { ...args, old_refresh_hash: oauthHash(parameter(params, "refresh_token")) });
    } else throw new LabOAuthError("unsupported_grant_type");
    if (!success) throw new LabOAuthError("invalid_grant");
    return json({ access_token: access, token_type: "Bearer", expires_in: 3600, refresh_token: refresh, scope: labOAuthScope });
  } catch (error) {
    const known = error instanceof LabOAuthError;
    const local = error instanceof LabError;
    return json({ error: known ? error.code : local ? (error.code === "LAB_FORBIDDEN" ? "access_denied" : "invalid_request") : "temporarily_unavailable" }, known ? error.status : local ? error.status : 503);
  }
}
