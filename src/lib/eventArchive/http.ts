import { NextResponse } from "next/server";
import { ArchiveError } from "./model";
export const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export function archiveResponse(value: unknown) { return NextResponse.json(value, { headers: privateHeaders }); }
export function archiveFailure(error: unknown) {
  return NextResponse.json({ error: error instanceof ArchiveError ? error.code : "ARCHIVE_UNAVAILABLE" }, { status: error instanceof ArchiveError ? error.status : 503, headers: privateHeaders });
}
export async function archiveBody(request: Request) {
  // Direct binary uploads use signed Storage URLs, never a multi-MB Vercel request body.
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ArchiveError("JSON_REQUIRED", 415);
  if (Number(request.headers.get("content-length")) > 2200000) throw new ArchiveError("REQUEST_TOO_LARGE", 413);
  const reader = request.body?.getReader(); if (!reader) throw new ArchiveError("INVALID_REQUEST");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length;
    if (size > 2200000) { await reader.cancel(); throw new ArchiveError("REQUEST_TOO_LARGE", 413); } chunks.push(value); }
  try { const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value as Record<string, unknown>;
  } catch { throw new ArchiveError("INVALID_REQUEST"); }
}
