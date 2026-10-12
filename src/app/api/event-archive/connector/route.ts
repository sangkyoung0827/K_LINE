import { getArchiveAccess, archiveConnectorToken } from "@/lib/eventArchive/access";
import { archiveClub, ArchiveError } from "@/lib/eventArchive/model";
import { archiveBody, archiveFailure, archiveResponse } from "@/lib/eventArchive/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.has("authorization")) throw new ArchiveError("INVALID_ORIGIN", 403);
    const access = await getArchiveAccess(), body = await archiveBody(request);
    if (body.confirmed !== true) throw new ArchiveError("EXPLICIT_APPROVAL_REQUIRED", 403);
    return archiveResponse({ token: archiveConnectorToken(access, archiveClub(body.clubKey)), expiresIn: 900 });
  } catch (error) { return archiveFailure(error); }
}
