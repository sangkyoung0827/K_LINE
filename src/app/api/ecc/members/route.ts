import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasSuperAdminAccess } from "@/lib/admin";
import {
  cleanText,
  SupabaseConfigError,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type EccMemberRow = {
  id: string;
  created_at: string;
  name: string;
  kakao_id: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  note: string | null;
  membership_fee_paid: boolean | null;
  team_chat_sent: boolean | null;
  team_chat_url: string | null;
  qr_code_url: string | null;
  payment_note: string | null;
  status: string | null;
};

const tableName = "ecc_members";
const selectedColumns =
  "id,created_at,name,kakao_id,email,phone,nationality,note,membership_fee_paid,team_chat_sent,team_chat_url,qr_code_url,payment_note,status";

function toClientMember(row: EccMemberRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    kakaoId: row.kakao_id,
    email: row.email ?? "",
    phone: row.phone ?? "",
    nationality: row.nationality ?? "",
    note: row.note ?? "",
    membershipFeePaid: Boolean(row.membership_fee_paid),
    teamChatSent: Boolean(row.team_chat_sent),
    teamChatUrl: row.team_chat_url ?? "",
    qrCodeUrl: row.qr_code_url ?? "",
    paymentNote: row.payment_note ?? "",
    status: row.status ?? "pending"
  };
}

async function requireSuperAdmin() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  return (await hasSuperAdminAccess(email)) ? email : "";
}

function apiErrorResponse(error: unknown) {
  console.error("ECC members API error", error);

  if (error instanceof SupabaseConfigError) {
    return NextResponse.json(
      {
        error:
          "ECC member storage is not configured yet. Please add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        debugCode: "ECC_MEMBERS_SUPABASE_CONFIG_MISSING"
      },
      { status: 503 }
    );
  }

  if (error instanceof SupabaseRequestError && error.status === 404) {
    return NextResponse.json(
      {
        error: "Supabase table public.ecc_members is not ready yet.",
        debugCode: "ECC_MEMBERS_TABLE_NOT_READY"
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      error: "ECC member storage is temporarily unavailable.",
      debugCode:
        error instanceof SupabaseRequestError
          ? "ECC_MEMBERS_SUPABASE_REQUEST_FAILED"
          : "ECC_MEMBERS_STORAGE_UNAVAILABLE"
    },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const email = await requireSuperAdmin();

    if (!email) {
      return NextResponse.json(
        { error: "Super-admin access required.", debugCode: "ECC_MEMBERS_FORBIDDEN" },
        { status: 403 }
      );
    }

    const rows = await supabaseRequest<EccMemberRow[]>(
      `${tableName}?select=${selectedColumns}&order=created_at.desc`
    );

    return NextResponse.json({ members: rows.map(toClientMember) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = cleanText(body.name);
    const kakaoId = cleanText(body.kakaoId ?? body.kakao_id);

    if (!name || !kakaoId) {
      return NextResponse.json(
        {
          error: "Name and KakaoTalk ID are required.",
          debugCode: "ECC_MEMBER_VALIDATION_FAILED"
        },
        { status: 400 }
      );
    }

    const rows = await supabaseRequest<EccMemberRow[]>(
      `${tableName}?select=${selectedColumns}`,
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          name,
          kakao_id: kakaoId,
          email: cleanText(body.email),
          phone: cleanText(body.phone),
          nationality: cleanText(body.nationality),
          note: cleanText(body.note, 1200),
          membership_fee_paid: false,
          team_chat_sent: false,
          team_chat_url: "",
          qr_code_url: "",
          payment_note: "",
          status: "pending"
        })
      }
    );

    return NextResponse.json(
      { member: rows[0] ? toClientMember(rows[0]) : null },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const email = await requireSuperAdmin();

    if (!email) {
      return NextResponse.json(
        { error: "Super-admin access required.", debugCode: "ECC_MEMBERS_FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      members?: Array<{
        id?: string;
        membershipFeePaid?: boolean;
        teamChatSent?: boolean;
        teamChatUrl?: string;
        qrCodeUrl?: string;
        paymentNote?: string;
      }>;
    };
    const updates = Array.isArray(body.members) ? body.members : [];

    await Promise.all(
      updates
        .map((member) => ({
          id: cleanText(member.id, 120),
          membershipFeePaid: Boolean(member.membershipFeePaid),
          teamChatSent: Boolean(member.teamChatSent),
          teamChatUrl: cleanText(member.teamChatUrl, 1000),
          qrCodeUrl: cleanText(member.qrCodeUrl, 1000),
          paymentNote: cleanText(member.paymentNote, 500)
        }))
        .filter((member) => member.id)
        .map((member) =>
          supabaseRequest<EccMemberRow[]>(
            `${tableName}?id=eq.${encodeURIComponent(member.id)}&select=${selectedColumns}`,
            {
              method: "PATCH",
              headers: {
                Prefer: "return=representation"
              },
              body: JSON.stringify({
                membership_fee_paid: member.membershipFeePaid,
                team_chat_sent: member.teamChatSent,
                team_chat_url: member.teamChatUrl,
                qr_code_url: member.qrCodeUrl,
                payment_note: member.paymentNote,
                status: member.membershipFeePaid ? "active" : "pending"
              })
            }
          )
        )
    );

    const rows = await supabaseRequest<EccMemberRow[]>(
      `${tableName}?select=${selectedColumns}&order=created_at.desc`
    );

    return NextResponse.json({ members: rows.map(toClientMember) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
