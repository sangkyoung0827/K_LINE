import { archiveActor } from "@/lib/eventArchive/access";
import { copyLegacy, legacyPreview } from "@/lib/eventArchive/legacy";
import { archiveBody, archiveFailure, archiveResponse } from "@/lib/eventArchive/http";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(request: Request) {
  try { return archiveResponse(await legacyPreview(await archiveActor(request))); } catch (error) { return archiveFailure(error); }
}
export async function POST(request: Request) {
  try { return archiveResponse(await copyLegacy(await archiveActor(request, true), await archiveBody(request))); } catch (error) { return archiveFailure(error); }
}
