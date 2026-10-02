import { NextResponse } from "next/server";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { isReadOnlyDeveloperEmail } from "@/lib/readOnlyDeveloper";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await supabaseRequest<{ content: Record<string, string> }[]>("hanhwal_introduction?select=content&id=eq.current&limit=1");
    return NextResponse.json({ content: rows[0]?.content ?? null });
  } catch (error) {
    console.error("Hanhwal introduction lookup failed", error);
    return NextResponse.json({ error: "Introduction could not be loaded." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const access = await getCurrentHanhwalAccess();
  if (!access.isAdmin || isReadOnlyDeveloperEmail(access.email)) {
    return NextResponse.json({ error: "Hanhwal administrator write access is required." }, { status: access.isLoggedIn ? 403 : 401 });
  }
  try {
    const input = await request.json();
    const content = Object.fromEntries(["titleKo", "titleEn", "bodyKo", "bodyEn"].map((key) => [key, cleanText(input[key], key.startsWith("title") ? 180 : 10000)]));
    if (!content.titleKo || !content.titleEn || !content.bodyKo || !content.bodyEn) {
      return NextResponse.json({ error: "A title and introduction in both languages are required." }, { status: 400 });
    }
    await supabaseRequest("hanhwal_introduction?on_conflict=id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ id: "current", content, updated_by: access.email, updated_at: new Date().toISOString() })
    });
    return NextResponse.json({ content });
  } catch (error) {
    console.error("Hanhwal introduction save failed", error);
    return NextResponse.json({ error: "Introduction could not be saved." }, { status: 500 });
  }
}
