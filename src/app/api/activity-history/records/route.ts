import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeEmail } from "@/lib/admin";
import { supabaseRequest } from "@/lib/supabaseServer";
import { ensureUserActivityRecords } from "@/lib/userActivityRecords";

export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

type ActivityHistoryRow = {
  id: string;
  source: "ecc" | "hanhwal";
  activity_id: string;
  activity_instance_id: string;
  activity_title_snapshot: string;
  activity_date_snapshot: string;
  eligible_at: string;
  rating: number | null;
  rated_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

export async function GET() {
  try {
    const session = await auth();
    const email = normalizeEmail(session?.user?.email);

    if (!email) {
      return NextResponse.json({ records: [] }, { headers: privateHeaders });
    }

    await ensureUserActivityRecords(email);

    const rows = await supabaseRequest<ActivityHistoryRow[]>(
      `user_activity_records?select=id,source,activity_id,activity_instance_id,activity_title_snapshot,activity_date_snapshot,eligible_at,rating,rated_at,dismissed_at,created_at&user_id=eq.${encodeURIComponent(email)}&order=activity_date_snapshot.desc&limit=500`
    );

    return NextResponse.json({
      records: rows.map((row) => ({
        activityDate: row.activity_date_snapshot,
        activityId: row.activity_id,
        activityInstanceId: row.activity_instance_id,
        activityTitle: row.activity_title_snapshot,
        createdAt: row.created_at,
        dismissedAt: row.dismissed_at,
        eligibleAt: row.eligible_at,
        id: row.id,
        ratedAt: row.rated_at,
        rating: row.rating,
        source: row.source
      }))
    }, { headers: privateHeaders });
  } catch (error) {
    console.error("Activity history records lookup failed", error);
    return NextResponse.json({ records: [], ready: false }, { headers: privateHeaders });
  }
}
