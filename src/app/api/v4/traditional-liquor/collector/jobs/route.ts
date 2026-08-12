import { NextResponse } from "next/server";
import { buildCollectorTargetUrl, getCollectorPlatform } from "@/lib/traditional-liquor/collector/platform-registry";
import { CollectorJobRepository, toPublicCollectorJob } from "@/lib/traditional-liquor/collector/job-repository";
import { createCollectorToken } from "@/lib/traditional-liquor/collector/job-token";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;
  try {
    const body = await request.json() as Record<string, unknown>;
    const platform = getCollectorPlatform(body.platformCode);
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 120) : "";
    if (!platform || !query) return NextResponse.json({ error: "플랫폼과 검색어를 확인하세요." }, { status: 400 });
    const { token, hash } = createCollectorToken();
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const job = await new CollectorJobRepository().create({
      requestedBy: access.email,
      platformCode: platform.code,
      query,
      targetUrl: buildCollectorTargetUrl(platform, query),
      tokenHash: hash,
      expiresAt
    });
    return NextResponse.json({ job: toPublicCollectorJob(job), collectorToken: token }, { status: 201 });
  } catch (error) {
    console.error("Collector job creation failed", error);
    return NextResponse.json({ error: "Collector Job을 생성하지 못했습니다.", debugCode: "TL_COLLECTOR_JOB_CREATE" }, { status: 500 });
  }
}
