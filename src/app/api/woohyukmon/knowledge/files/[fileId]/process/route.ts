import { NextResponse } from "next/server";
import { requireKnowledgeDeveloperApi } from "@/lib/knowledge/access";
import { processKnowledgeFile } from "@/lib/knowledge/pipeline";
import { UnsupportedKnowledgeFileError } from "@/lib/knowledge/parsers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Context = { params: Promise<{ fileId: string }> };

export async function POST(_: Request, context: Context) {
  const guard = await requireKnowledgeDeveloperApi();
  if (guard.response) return guard.response;
  const { fileId } = await context.params;
  try {
    const file = await processKnowledgeFile(fileId);
    return NextResponse.json({ file });
  } catch (error) {
    const unsupported = error instanceof UnsupportedKnowledgeFileError;
    return NextResponse.json(
      {
        debugCode: unsupported ? "KNOWLEDGE_ANALYSIS_UNSUPPORTED" : "KNOWLEDGE_PROCESS_FAILED",
        error: unsupported ? error.message : "파일 분석에 실패했습니다. 원본은 안전하게 보존되었습니다."
      },
      { status: unsupported ? 422 : 500 }
    );
  }
}
