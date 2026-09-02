import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeEmail } from "@/lib/admin";
import {
  dismissActivityRecord,
  getPendingActivityRating,
  rateActivityRecord
} from "@/lib/userActivityRecords";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    const email = normalizeEmail(session?.user?.email);

    if (!email) {
      return NextResponse.json({ rating: null });
    }

    return NextResponse.json({ rating: await getPendingActivityRating(email) });
  } catch (error) {
    // The modal is an additive convenience. A missing migration or temporary
    // history-store failure must not affect normal K_LINE page rendering.
    console.error("Activity rating lookup failed", error);
    return NextResponse.json({ rating: null, ready: false });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    const email = normalizeEmail(session?.user?.email);

    if (!email) {
      return NextResponse.json({ error: "Login is required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      action?: unknown;
      rating?: unknown;
      recordId?: unknown;
    };
    const recordId = typeof body.recordId === "string" ? body.recordId.trim() : "";

    if (!recordId) {
      return NextResponse.json({ error: "Activity record is required." }, { status: 400 });
    }

    if (body.action === "dismiss") {
      const record = await dismissActivityRecord({ recordId, userId: email });
      return record
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "Activity record was not found." }, { status: 404 });
    }

    const rating = Number(body.rating);

    if (body.action !== "rate" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Choose a rating from 1 to 5." }, { status: 400 });
    }

    const record = await rateActivityRecord({ rating, recordId, userId: email });
    return record
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Activity record was not found." }, { status: 404 });
  } catch (error) {
    console.error("Activity rating update failed", error);
    return NextResponse.json({ error: "Activity rating could not be saved." }, { status: 500 });
  }
}
