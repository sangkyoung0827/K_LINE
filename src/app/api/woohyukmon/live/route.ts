import { NextResponse } from "next/server";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { cleanText, SupabaseConfigError, SupabaseRequestError, supabaseRequest } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type FundRow = { displayed_balance_krw: number; total_donation_krw: number; updated_at: string };
type ApplicationRow = { activity_id: string; status: string };
type MemberRow = { email: string; role: string | null; official_member_status: string | null };
type SiteMemberRow = { email: string };
type BoardPostRow = { id: string; created_at: string; title: string };

const eccBoardColumns = "id,created_at,board_id,title,author_name,author_email,content,media,status";
const hanhwalBoardColumns = "id,created_at,title,author_name,author_email,content,media,status";

function failure(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json({ error: "Live K_LINE data is not configured." }, { status: 503 });
  }
  if (error instanceof SupabaseRequestError && error.status === 404) {
    return NextResponse.json({ error: "Required K_LINE data table is not ready." }, { status: 503 });
  }
  console.error("Woohyukmon live action error", error);
  return NextResponse.json({ error: "Live K_LINE data is temporarily unavailable." }, { status: 500 });
}

async function audit(userEmail: string, actionType: string, target: string, details: Record<string, unknown>) {
  await supabaseRequest("woohyukmon_action_audit", {
    method: "POST",
    body: JSON.stringify({ action_type: actionType, details, target, user_email: userEmail })
  });
}

export async function GET(request: Request) {
  try {
    const access = await getCurrentEccAccess();
    const kind = new URL(request.url).searchParams.get("kind");

    if (!access.isLoggedIn) {
      return NextResponse.json({ error: "Google login is required." }, { status: 401 });
    }

    if (kind === "fund") {
      if (!access.isSuperAdmin) {
        return NextResponse.json({ error: "Super-admin access is required for ECC fund information." }, { status: 403 });
      }
      const rows = await supabaseRequest<FundRow[]>(
        "ecc_fund_settings?select=displayed_balance_krw,total_donation_krw,updated_at&id=eq.ecc&limit=1"
      );
      const fund = rows[0];
      return NextResponse.json({
        summary: fund
          ? { displayedBalance: Number(fund.displayed_balance_krw), totalDonationKrw: Number(fund.total_donation_krw), updatedAt: fund.updated_at }
          : null
      });
    }

    if (kind === "applications") {
      if (!access.isAdmin) {
        return NextResponse.json({ error: "Admin access is required for activity application data." }, { status: 403 });
      }
      const rows = await supabaseRequest<ApplicationRow[]>(
        "ecc_activity_applications?select=activity_id,status&limit=1000"
      );
      const byActivity = rows.reduce<Record<string, number>>((result, row) => {
        result[row.activity_id] = (result[row.activity_id] ?? 0) + 1;
        return result;
      }, {});
      return NextResponse.json({ summary: { byActivity, total: rows.length } });
    }

    if (kind === "members") {
      if (!access.isAdmin) {
        return NextResponse.json({ error: "Admin access is required for member data." }, { status: 403 });
      }
      const [roles, siteMembers] = await Promise.all([
        supabaseRequest<MemberRow[]>("ecc_roles?select=email,role,official_member_status&limit=1000"),
        supabaseRequest<SiteMemberRow[]>("site_members?select=email&limit=1000")
      ]);
      return NextResponse.json({
        summary: {
          officialMembers: roles.filter((row) => row.official_member_status === "approved").length,
          registeredUsers: new Set(siteMembers.map((row) => row.email.toLowerCase())).size,
          totalRoleRecords: roles.length
        }
      });
    }

    return NextResponse.json({ error: "Unsupported live data request." }, { status: 400 });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const boardId = cleanText(body.boardId, 20);
    const title = cleanText(body.title, 180);
    const content = cleanText(body.content, 8000);
    const media = Array.isArray(body.media)
      ? body.media
          .filter((item): item is { name?: unknown; type?: unknown; url?: unknown } => Boolean(item && typeof item === "object"))
          .map((item) => ({ name: cleanText(item.name, 200), type: cleanText(item.type, 120), url: cleanText(item.url, 1200) }))
          .filter((item) => item.url)
          .slice(0, 12)
      : [];

    if ((boardId !== "ecc" && boardId !== "hanhwal") || !title || !content) {
      return NextResponse.json({ error: "Board, title, and content are required." }, { status: 400 });
    }

    const access = boardId === "hanhwal" ? await getCurrentHanhwalAccess() : await getCurrentEccAccess();
    if (!access.isAdmin) {
      return NextResponse.json(
        { error: `${boardId === "hanhwal" ? "Hanhwal" : "ECC"} admin access is required to publish this post.` },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const tableName = boardId === "hanhwal" ? "hanhwal_board_posts" : "club_board_posts";
    const selectedColumns = boardId === "hanhwal" ? hanhwalBoardColumns : eccBoardColumns;
    const rows = await supabaseRequest<BoardPostRow[]>(`${tableName}?select=${selectedColumns}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        author_email: access.email,
        author_name: access.email,
        content,
        media,
        status: "published",
        title,
        ...(boardId === "ecc" ? { board_id: "ecc" } : {})
      })
    });
    try {
      await audit(access.email, "publish_board_post", boardId, { mediaCount: media.length, title });
    } catch (auditError) {
      console.error("Woohyukmon action audit failed", auditError);
    }
    return NextResponse.json({ post: rows[0] ?? null }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
