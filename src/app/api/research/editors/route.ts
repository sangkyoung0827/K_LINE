import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/admin";
import { supabaseRequest } from "@/lib/supabaseServer";
import { getResearchEditorAccess, sameOrigin } from "@/lib/research/server";

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const access = await getResearchEditorAccess();
    if (!access.canManageEditors) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const input = await request.json() as { email?: string };
    if (typeof input.email !== "string") return NextResponse.json({ error: "Enter a valid login email." }, { status: 400 });
    const email = normalizeEmail(input.email);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid login email." }, { status: 400 });
    await supabaseRequest("kline_research_editors?on_conflict=email", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ email, added_by: access.email })
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Research editor invitation failed", error);
    return NextResponse.json({ error: "Research editor could not be added." }, { status: 500 });
  }
}
