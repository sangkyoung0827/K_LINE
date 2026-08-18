import { NextResponse } from "next/server";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import {
  cleanText,
  SupabaseConfigError,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type HanhwalPostRow = {
  author_email: string;
  author_name: string;
  content: string;
  created_at: string;
  id: string;
  media: Array<{ name?: string; type?: string; url?: string }> | null;
  status: string;
  title: string;
};

const tableName = "hanhwal_board_posts";
const columns = "id,title,author_name,author_email,content,media,status,created_at";

function toPost(row: HanhwalPostRow) {
  return {
    author: row.author_name,
    boardId: "hanhwal" as const,
    content: row.content,
    createdAt: row.created_at,
    id: row.id,
    imageDataUrl: row.media?.find((item) => item.type?.startsWith("image/"))?.url ?? "",
    imageName: row.media?.[0]?.name ?? "",
    media: row.media ?? [],
    title: row.title
  };
}

function errorResponse(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json(
      { error: "Hanhwal board storage is not configured.", debugCode: "HANHWAL_POSTS_CONFIG_MISSING" },
      { status: 503 }
    );
  }

  if (error instanceof SupabaseRequestError && error.status === 404) {
    return NextResponse.json(
      { error: "Hanhwal board storage is not ready.", debugCode: "HANHWAL_POSTS_TABLE_NOT_READY" },
      { status: 503 }
    );
  }

  console.error("Hanhwal board API error", error);
  return NextResponse.json(
    { error: "Hanhwal board is temporarily unavailable.", debugCode: "HANHWAL_POSTS_UNAVAILABLE" },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isOfficialMember) {
      return NextResponse.json(
        { error: "Hanhwal official membership is required." },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const rows = await supabaseRequest<HanhwalPostRow[]>(
      `${tableName}?select=${columns}&status=eq.published&order=created_at.desc&limit=120`
    );

    return NextResponse.json({ posts: rows.map(toPost) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isOfficialMember || !access.email) {
      return NextResponse.json(
        { error: "Hanhwal official membership is required." },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const title = cleanText(body.title, 180);
    const authorName = cleanText(body.author, 120);
    const content = cleanText(body.content, 8000);
    const imageDataUrl = cleanText(body.imageDataUrl, 2_500_000);
    const imageName = cleanText(body.imageName, 200);

    if (!title || !authorName || !content) {
      return NextResponse.json({ error: "Title, name, and content are required." }, { status: 400 });
    }

    if (imageDataUrl && !imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
    }

    const media = imageDataUrl
      ? [{ name: imageName, type: imageDataUrl.slice(5, imageDataUrl.indexOf(";")), url: imageDataUrl }]
      : [];
    const rows = await supabaseRequest<HanhwalPostRow[]>(`${tableName}?select=${columns}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        author_email: access.email,
        author_name: authorName,
        content,
        media,
        status: "published",
        title
      })
    });

    return NextResponse.json({ post: rows[0] ? toPost(rows[0]) : null }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isAdmin) {
      return NextResponse.json(
        { error: "Hanhwal admin access is required." },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const id = cleanText(new URL(request.url).searchParams.get("id"), 120);

    if (!id) {
      return NextResponse.json({ error: "Post id is required." }, { status: 400 });
    }

    await supabaseRequest<null>(`${tableName}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
