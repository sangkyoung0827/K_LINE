import { NextResponse } from "next/server";
import { CollectorJobRepository, toPublicCollectorJob } from "@/lib/traditional-liquor/collector/job-repository";
import { bearerToken, collectorTokenMatches } from "@/lib/traditional-liquor/collector/job-token";
import type { CollectorJobStatus } from "@/lib/traditional-liquor/collector/types";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";
const extensionStatuses = new Set<CollectorJobStatus>(["DISPATCHED", "RUNNING", "FAILED"]);
const allowedTransitions: Record<string, Set<CollectorJobStatus>> = {
  PENDING: new Set(["DISPATCHED", "RUNNING", "FAILED"]),
  DISPATCHED: new Set(["RUNNING", "FAILED"]),
  RUNNING: new Set(["FAILED"]),
  UPLOADING: new Set(["FAILED"])
};

export async function GET(_: Request, context: { params: Promise<{ jobId: string }> }) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;
  const { jobId } = await context.params;
  try {
    const job = await new CollectorJobRepository().get(jobId);
    if (!job) return NextResponse.json({ error: "Collector Job을 찾을 수 없습니다." }, { status: 404 });
    if (Date.parse(job.expires_at) <= Date.now() && !["COMPLETED", "FAILED", "EXPIRED"].includes(job.status)) {
      const expired = await new CollectorJobRepository().update(job.id, { status: "EXPIRED", finishedAt: new Date().toISOString(), errorMessage: "Collector token expired." });
      return NextResponse.json({ job: expired ? toPublicCollectorJob(expired) : toPublicCollectorJob(job) });
    }
    return NextResponse.json({ job: toPublicCollectorJob(job) });
  } catch (error) {
    console.error("Collector job lookup failed", error);
    return NextResponse.json({ error: "Collector 상태를 불러오지 못했습니다.", debugCode: "TL_COLLECTOR_JOB_GET" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const repository = new CollectorJobRepository();
  try {
    const job = await repository.get(jobId);
    const token = bearerToken(request);
    if (!job || !token || !collectorTokenMatches(token, job.token_hash)) return NextResponse.json({ error: "Invalid collector token." }, { status: 401 });
    if (Date.parse(job.expires_at) <= Date.now()) return NextResponse.json({ error: "Collector token expired." }, { status: 410 });
    if (["COMPLETED", "EXPIRED"].includes(job.status)) return NextResponse.json({ error: "Collector Job is closed." }, { status: 409 });
    const body = await request.json() as Record<string, unknown>;
    const status = typeof body.status === "string" ? body.status as CollectorJobStatus : null;
    if (!status || !extensionStatuses.has(status)) return NextResponse.json({ error: "Invalid collector status." }, { status: 400 });
    if (!allowedTransitions[job.status]?.has(status)) return NextResponse.json({ error: `Invalid collector status transition: ${job.status} -> ${status}` }, { status: 409 });
    const now = new Date().toISOString();
    const updated = await repository.update(job.id, {
      status,
      ...(status === "RUNNING" && !job.started_at ? { startedAt: now } : {}),
      ...(status === "FAILED" ? { finishedAt: now, errorMessage: typeof body.errorMessage === "string" ? body.errorMessage.slice(0, 500) : "Collector failed." } : {})
    });
    return NextResponse.json({ job: updated ? toPublicCollectorJob(updated) : toPublicCollectorJob(job) });
  } catch (error) {
    console.error("Collector job status update failed", error);
    return NextResponse.json({ error: "Collector 상태를 갱신하지 못했습니다.", debugCode: "TL_COLLECTOR_JOB_PATCH" }, { status: 500 });
  }
}
