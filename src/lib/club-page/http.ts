import "server-only";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSupabaseConfig } from "@/lib/supabaseServer";
import { isClubKey } from "./config";
import { requireClubEditor } from "./access";
import { getClubDraft, getPublishedClubPage, writeClubPage } from "./server";
import { ClubPageError, MAX_DOCUMENT_BYTES, validateWrite } from "./validation";
import { MAX_MEDIA_BYTES, normalizeImage } from "./media";

export type ClubRouteContext = { params: Promise<{ clubKey: string }> };
async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new ClubPageError("파일 또는 요청 크기가 너무 큽니다.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ClubPageError("요청 내용이 없습니다.");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new ClubPageError("파일 또는 요청 크기가 너무 큽니다.", 413);
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}
export async function handleClubRequest(
  request: Request,
  context: ClubRouteContext,
  action: "published" | "draft" | "publish" | "unpublish" | "media",
) {
  try {
    const { clubKey } = await context.params;
    if (!isClubKey(clubKey))
      throw new ClubPageError("동아리를 찾을 수 없습니다.", 404);
    if (action === "published")
      return NextResponse.json(
        { page: await getPublishedClubPage(clubKey) },
        { headers: { "Cache-Control": "no-store" } },
      );
    const access = await requireClubEditor(clubKey);
    if (request.method === "GET")
      return NextResponse.json(await getClubDraft(clubKey), {
        headers: { "Cache-Control": "private, no-store" },
      });
    // Same-origin writes supplement session checks; no permissive CORS policy.
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new ClubPageError("허용되지 않은 요청입니다.", 403);
    if (action === "media") {
      const buffer = await boundedBody(request, MAX_MEDIA_BYTES + 100_000);
      const form = await new Response(buffer, {
        headers: { "content-type": request.headers.get("content-type") || "" },
      }).formData();
      const file = form.get("file");
      if (!(file instanceof File))
        throw new ClubPageError("이미지를 선택해 주세요.");
      const { bytes, extension } = await normalizeImage(
        Buffer.from(await file.arrayBuffer()),
        file.type,
        file.name,
      );
      const config = getSupabaseConfig();
      const path = `${clubKey}/${randomUUID()}.${extension}`;
      const response = await fetch(
        `${config.url}/storage/v1/object/club-page-media/${path}`,
        {
          method: "POST",
          body: bytes,
          headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            "Content-Type": file.type,
            "x-upsert": "false",
          },
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!response.ok) throw new Error("Storage upload failed");
      return NextResponse.json(
        {
          url: `${config.url}/storage/v1/object/public/club-page-media/${path}`,
        },
        { status: 201 },
      );
    }
    const body = await boundedBody(request, MAX_DOCUMENT_BYTES + 1000);
    let json: unknown;
    try {
      json = JSON.parse(body.toString("utf8"));
    } catch {
      throw new ClubPageError("JSON 형식이 올바르지 않습니다.");
    }
    const { document, revision } = validateWrite(
      json,
      clubKey,
      getSupabaseConfig().url,
    );
    if (action === "publish" && document.sections.length === 0)
      throw new ClubPageError("공개할 블록을 먼저 추가해 주세요.");
    const nextRevision = await writeClubPage(
      clubKey,
      document,
      revision,
      action,
      access.email,
    );
    return NextResponse.json({ revision: nextRevision });
  } catch (error) {
    if (error instanceof ClubPageError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error("Club website request failed", {
      action,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    const message =
      action === "media"
        ? "이미지를 업로드하지 못했습니다."
        : action === "publish" || action === "unpublish"
          ? "웹사이트 공개에 실패했습니다."
          : request.method === "GET"
            ? "웹사이트 편집 데이터를 불러오지 못했습니다."
            : "저장에 실패했습니다. 기존 데이터는 변경되지 않았습니다.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
