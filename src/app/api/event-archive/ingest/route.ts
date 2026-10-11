import { archiveActor } from "@/lib/eventArchive/access";
import { prepareImport, finalizeImport, importStatus, pendingImports, cleanImportOrphans } from "@/lib/eventArchive/service";
import { archiveBody, archiveFailure, archiveResponse } from "@/lib/eventArchive/http";
import { ArchiveError } from "@/lib/eventArchive/model";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const access = await archiveActor(request, true), body = await archiveBody(request);
    if (body.action === "pending") return archiveResponse(await pendingImports(access));
    if (body.action === "finalize") return archiveResponse(await finalizeImport(access, String(body.batchId || "")));
    if (body.action === "status") return archiveResponse(await importStatus(access, String(body.batchId || "")));
    if (body.action === "cleanup") {
      if (body.confirmed !== true) throw new ArchiveError("EXPLICIT_APPROVAL_REQUIRED", 403);
      return archiveResponse(await cleanImportOrphans(access, String(body.batchId || "")));
    }
    return archiveResponse(await prepareImport(access, body));
  } catch (error) { return archiveFailure(error); }
}
