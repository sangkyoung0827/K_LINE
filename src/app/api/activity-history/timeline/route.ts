import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeEmail } from "@/lib/admin";
import { supabaseRequest } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };
const pageSize = 50;
type Cursor = { date: string | null; id: string };
type Row = {
  id: string;
  source: "ecc" | "hanhwal";
  activity_title_snapshot: string;
  activity_date_snapshot: string | null;
  rating: number | null;
};

function readCursor(value: string): Cursor {
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid cursor");
  const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
  if (!cursor || typeof cursor.id !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(cursor.id)) throw new Error("Invalid cursor");
  if (cursor.date !== null && (typeof cursor.date !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(cursor.date) || !Number.isFinite(Date.parse(cursor.date)))) throw new Error("Invalid cursor");
  return { id: cursor.id, date: cursor.date };
}

export async function GET(request: Request) {
  try {
    const email = normalizeEmail((await auth())?.user?.email);
    if (!email) return NextResponse.json({ error: "Login required." }, { status: 401, headers: privateHeaders });
    let cursor: Cursor | null = null;
    try {
      const raw = new URL(request.url).searchParams.get("cursor");
      if (raw !== null) cursor = readCursor(raw);
    } catch {
      return NextResponse.json({ error: "Invalid history cursor." }, { status: 400, headers: privateHeaders });
    }
    const query = new URLSearchParams({
      select: "id,source,activity_title_snapshot,activity_date_snapshot,rating",
      user_id: `eq.${email}`,
      order: "activity_date_snapshot.desc.nullslast,id.desc",
      limit: String(pageSize + 1)
    });
    // The snapshot is the registration-close time, not verified event attendance/date.
    if (cursor?.date) query.set("or", `(activity_date_snapshot.lt.${cursor.date},and(activity_date_snapshot.eq.${cursor.date},id.lt.${cursor.id}),activity_date_snapshot.is.null)`);
    else if (cursor) {
      query.set("activity_date_snapshot", "is.null");
      query.set("id", `lt.${cursor.id}`);
    }
    const rows = await supabaseRequest<Row[]>(`user_activity_records?${query}`, {
      method: "GET", cache: "no-store", signal: AbortSignal.timeout(12000)
    });
    const page = rows.slice(0, pageSize);
    const last = page.at(-1);
    return NextResponse.json({
      ownerEmail: email,
      records: page.map((row) => ({ id: row.id, source: row.source, activityTitle: row.activity_title_snapshot, closedAt: row.activity_date_snapshot, rating: row.rating })),
      nextCursor: rows.length > pageSize && last
        ? Buffer.from(JSON.stringify({ date: last.activity_date_snapshot, id: last.id })).toString("base64url") : null
    }, { headers: privateHeaders });
  } catch (error) {
    console.error("My history lookup failed", error);
    return NextResponse.json({ error: "Activity history could not be loaded." }, { status: 503, headers: privateHeaders });
  }
}
