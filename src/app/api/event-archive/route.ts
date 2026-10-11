import { archiveActor } from "@/lib/eventArchive/access";
import { archiveDownload, listArchive, loadArchiveItem, saveLabels, reviewArchive, newArchiveVersion } from "@/lib/eventArchive/service";
import { classifyArchive } from "@/lib/eventArchive/ai";
import { archiveBody, archiveFailure, archiveResponse } from "@/lib/eventArchive/http";
import { ArchiveError } from "@/lib/eventArchive/model";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(request: Request) {
  try {
    const access = await archiveActor(request), q = new URL(request.url).searchParams;
    if (q.get("id") && q.get("asset")) return archiveResponse(await archiveDownload(access, q.get("id")!, q.get("asset")!));
    if (q.get("id")) return archiveResponse({ item: await loadArchiveItem(access, q.get("id")!) });
    return archiveResponse(await listArchive(access, q));
  } catch (error) { return archiveFailure(error); }
}
export async function POST(request: Request) {
  try {
    const access = await archiveActor(request, true), body = await archiveBody(request), id = String(body.id || "");
    if (body.action === "labels") return archiveResponse(await saveLabels(access, id, body.labels));
    if (body.action === "review") return archiveResponse(await reviewArchive(access, id, body));
    if (body.action === "classify") return archiveResponse(await classifyArchive(access, id));
    if (body.action === "version") return archiveResponse(await newArchiveVersion(access, id, body.text, body.idempotencyKey));
    throw new ArchiveError("UNKNOWN_ARCHIVE_ACTION");
  } catch (error) { return archiveFailure(error); }
}
