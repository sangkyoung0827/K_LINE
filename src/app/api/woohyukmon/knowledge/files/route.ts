import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireKnowledgeDeveloperApi } from "@/lib/knowledge/access";
import {
  createKnowledgeFile,
  findKnowledgeFileByHash,
  listKnowledgeFiles
} from "@/lib/knowledge/repository";
import { createKnowledgeSignedUpload, ensureKnowledgeBucket, knowledgeObjectExists } from "@/lib/knowledge/storage";
import { SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function safeStorageName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-160) || "knowledge-file";
}

function extensionOf(name: string) {
  return (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
}

function normalizeMimeType(value: string, extension: string) {
  if (value && value !== "application/octet-stream") return value;
  const known: Record<string, string> = {
    csv: "text/csv", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    gif: "image/gif", jpeg: "image/jpeg", jpg: "image/jpeg", json: "application/json",
    md: "text/markdown", pdf: "application/pdf", png: "image/png",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain", webp: "image/webp",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", zip: "application/zip"
  };
  return known[extension] || "application/octet-stream";
}

function errorResponse(error: unknown, operation: string) {
  console.error(`Knowledge ${operation} failed`, error);
  const notReady = error instanceof SupabaseRequestError && [400, 404].includes(error.status);
  return NextResponse.json(
    {
      debugCode: notReady ? "KNOWLEDGE_SCHEMA_NOT_READY" : `KNOWLEDGE_${operation.toUpperCase()}_FAILED`,
      error: notReady
        ? "우혁몬 교육 데이터베이스 설정이 아직 적용되지 않았습니다."
        : "우혁몬 교육 저장소를 처리하지 못했습니다."
    },
    { status: notReady ? 503 : 500 }
  );
}

export async function GET(request: Request) {
  const guard = await requireKnowledgeDeveloperApi();
  if (guard.response) return guard.response;
  const url = new URL(request.url);
  try {
    const requestedStatus = url.searchParams.get("status") || "ALL";
    const files = await listKnowledgeFiles({
      limit: Number(url.searchParams.get("limit") || 200),
      query: url.searchParams.get("query") || "",
      status: requestedStatus === "PROCESSING" ? "ALL" : requestedStatus
    });
    const visibleFiles = requestedStatus === "PROCESSING"
      ? files.filter((file) => ["EXTRACTING", "ANALYZING", "CHUNKING", "EMBEDDING", "INDEXING"].includes(file.processing_status))
      : files;
    const summary = files.reduce(
      (result, file) => {
        result.total += 1;
        if (file.processing_status === "READY") result.ready += 1;
        else if (file.processing_status === "FAILED") result.failed += 1;
        else if (file.processing_status === "UNSUPPORTED") result.unsupported += 1;
        else if (file.processing_status === "UPLOADED" || file.processing_status === "QUEUED") result.queued += 1;
        else result.processing += 1;
        return result;
      },
      { failed: 0, processing: 0, queued: 0, ready: 0, total: 0, unsupported: 0 }
    );
    return NextResponse.json({ files: visibleFiles, summary });
  } catch (error) {
    return errorResponse(error, "list");
  }
}

export async function POST(request: Request) {
  const guard = await requireKnowledgeDeveloperApi();
  if (guard.response) return guard.response;
  try {
    const body = (await request.json()) as {
      extension?: unknown;
      mimeType?: unknown;
      name?: unknown;
      sha256?: unknown;
      sizeBytes?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 500) : "";
    const rawMimeType = typeof body.mimeType === "string" ? body.mimeType.trim().slice(0, 200) : "application/octet-stream";
    const sha256 = typeof body.sha256 === "string" ? body.sha256.toLowerCase().trim() : "";
    const sizeBytes = typeof body.sizeBytes === "number" ? Math.max(0, Math.floor(body.sizeBytes)) : -1;
    if (!name || !/^[a-f0-9]{64}$/.test(sha256) || sizeBytes < 0) {
      return NextResponse.json(
        { error: "Invalid file metadata.", debugCode: "KNOWLEDGE_FILE_METADATA_INVALID" },
        { status: 400 }
      );
    }
    const extension = typeof body.extension === "string" ? body.extension.toLowerCase().slice(0, 16) : extensionOf(name);
    const mimeType = normalizeMimeType(rawMimeType, extension);
    const duplicate = await findKnowledgeFileByHash(sha256);
    if (duplicate) {
      if (duplicate.processing_status === "UPLOADED" && !(await knowledgeObjectExists(duplicate.storage_path))) {
        const signed = await createKnowledgeSignedUpload(duplicate.storage_path);
        return NextResponse.json({ duplicate: false, file: duplicate, resumed: true, ...signed });
      }
      return NextResponse.json({ duplicate: true, file: duplicate }, { status: 200 });
    }
    await ensureKnowledgeBucket();
    const date = new Date().toISOString().slice(0, 10);
    const storagePath = `${date}/${randomUUID()}-${safeStorageName(name)}`;
    const file = await createKnowledgeFile({
      extension,
      mimeType: mimeType || "application/octet-stream",
      originalName: name,
      sha256,
      sizeBytes,
      storagePath,
      uploadedBy: guard.access.email
    });
    const signed = await createKnowledgeSignedUpload(storagePath);
    return NextResponse.json({ duplicate: false, file, ...signed }, { status: 201 });
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.status === 409) {
      return NextResponse.json(
        { error: "이미 등록된 동일 파일입니다.", debugCode: "KNOWLEDGE_DUPLICATE_FILE" },
        { status: 409 }
      );
    }
    return errorResponse(error, "prepare");
  }
}
