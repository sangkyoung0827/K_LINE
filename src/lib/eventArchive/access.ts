import "server-only";
import { auth } from "@/auth";
import { getAdminAccess, normalizeEmail } from "@/lib/admin";
import { createSignedWoohyukmonPayload, verifySignedWoohyukmonPayload } from "@/lib/woohyukmon/operations/token";
import { archiveClubs, ArchiveError, type ArchiveAccess, type ArchiveClub } from "./model";

export async function getArchiveAccess(verifiedEmail?: string): Promise<ArchiveAccess> {
  const email = normalizeEmail(verifiedEmail ?? (await auth())?.user?.email);
  if (!email) return { email: "", clubs: [], superAdmin: false, readOnly: true };
  const global = await getAdminAccess(email);
  if (!global.isDeveloper) throw new ArchiveError("DEVELOPER_REQUIRED", 403);
  return { email, clubs: [...archiveClubs], superAdmin: true, readOnly: Boolean(global.isReadOnly) };
}
type ConnectorToken = { namespace: string; actor: string; club: ArchiveClub; expires: number };
export function archiveConnectorToken(access: ArchiveAccess, club: ArchiveClub) {
  if (!access.email || access.readOnly || !access.clubs.includes(club)) throw new ArchiveError("CLUB_ADMIN_REQUIRED", 403);
  return createSignedWoohyukmonPayload({ namespace: "event_archive_connector_v1", actor: access.email, club, expires: Date.now() + 15 * 60000 } satisfies ConnectorToken);
}
export async function archiveActor(request: Request, write = false): Promise<ArchiveAccess> {
  const bearer = request.headers.get("authorization");
  if (bearer) {
    if (!bearer.startsWith("Bearer ") || bearer.length > 3000) throw new ArchiveError("INVALID_CONNECTOR_TOKEN", 401);
    let token: ConnectorToken;
    try { token = verifySignedWoohyukmonPayload(bearer.slice(7)) as ConnectorToken; } catch { throw new ArchiveError("INVALID_CONNECTOR_TOKEN", 401); }
    if (token.namespace !== "event_archive_connector_v1" || !token.actor || !archiveClubs.includes(token.club) ||
      !Number.isFinite(token.expires) || token.expires <= Date.now() || token.expires > Date.now() + 15 * 60000) throw new ArchiveError("CONNECTOR_TOKEN_EXPIRED", 401);
    // Re-check authoritative roles on EVERY request. Token scope never widens current access.
    const access = await getArchiveAccess(token.actor);
    if (access.readOnly || !access.clubs.includes(token.club)) throw new ArchiveError("CONNECTOR_ACCESS_REVOKED", 403);
    return { ...access, clubs: [token.club], superAdmin: access.superAdmin && token.club === "unclassified" };
  }
  if (write && request.headers.get("origin") !== new URL(request.url).origin) throw new ArchiveError("INVALID_ORIGIN", 403);
  const access = await getArchiveAccess();
  if (!access.email) throw new ArchiveError("LOGIN_REQUIRED", 401);
  return access;
}
