import { NextResponse } from "next/server";
import { collectorResultToParsedImport, summarizeCollectorResult, validateCollectorResult } from "@/lib/traditional-liquor/collector/import-adapter";
import { CollectorJobRepository, toPublicCollectorJob } from "@/lib/traditional-liquor/collector/job-repository";
import { bearerToken, collectorTokenMatches } from "@/lib/traditional-liquor/collector/job-token";
import { RealImportRepository } from "@/lib/traditional-liquor/import/real-import-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const jobs = new CollectorJobRepository();
  let claimed = false;
  try {
    const job = await jobs.get(jobId);
    const token = bearerToken(request);
    if (!job || !token || !collectorTokenMatches(token, job.token_hash)) return NextResponse.json({ error: "Invalid collector token." }, { status: 401 });
    if (Date.parse(job.expires_at) <= Date.now()) return NextResponse.json({ error: "Collector token expired." }, { status: 410 });
    if (job.status === "COMPLETED") return NextResponse.json({ error: "Collector result was already accepted.", batchId: job.batch_id }, { status: 409 });
    if (["FAILED", "EXPIRED"].includes(job.status)) return NextResponse.json({ error: "Collector Job is closed." }, { status: 409 });

    const payload = validateCollectorResult(await request.json());
    if (payload.platformCode !== job.platform_code || payload.query.trim() !== job.query) return NextResponse.json({ error: "Collector payload does not match this Job." }, { status: 400 });
    const claimedJob = await jobs.claimForUpload(job.id);
    if (!claimedJob) return NextResponse.json({ error: "Collector result was already claimed or the Job is not running." }, { status: 409 });
    claimed = true;
    const converted = collectorResultToParsedImport(payload);
    if (!converted.parsed.records.length) throw new Error("NO_COLLECTOR_OFFERS");
    const staged = await new RealImportRepository().stageFile(converted.parsed, converted.mapping, converted.sourceName, payload.collectedAt, "COLLECTOR");
    const summary = summarizeCollectorResult(payload, staged.total, converted.skipped);
    const completed = await jobs.update(job.id, {
      status: "COMPLETED",
      batchId: staged.batchId,
      diagnostics: payload.diagnostics,
      resultSummary: summary,
      finishedAt: new Date().toISOString(),
      errorMessage: null
    });
    return NextResponse.json({ job: completed ? toPublicCollectorJob(completed) : null, batch: staged, summary }, { status: 201 });
  } catch (error) {
    console.error("Collector result upload failed", error);
    if (claimed) await jobs.update(jobId, { status: "FAILED", finishedAt: new Date().toISOString(), errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Collector result upload failed." }).catch(() => undefined);
    const known = error instanceof Error && /^(INVALID_COLLECTOR|COLLECTOR_ITEM_LIMIT|UNKNOWN_COLLECTOR|NO_COLLECTOR)/.test(error.message);
    return NextResponse.json({ error: known ? error.message : "Collector 결과를 Staging에 저장하지 못했습니다.", debugCode: "TL_COLLECTOR_RESULT" }, { status: known ? 400 : 500 });
  }
}
