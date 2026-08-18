import { NextResponse } from "next/server";
import { supabaseRequest, SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type Row = {
  author_name: string;
  board_id: "ecc";
  content: string;
  created_at: string;
  id: string;
  media: Array<{ name?: string; type?: string; url?: string }> | null;
  title: string;
};

export async function GET(request: Request) {
  try {
    const board = new URL(request.url).searchParams.get("board");
    if (board !== "ecc") {
      return NextResponse.json({ error: "The ECC board is required." }, { status: 400 });
    }
    const rows = await supabaseRequest<Row[]>(
      `club_board_posts?select=id,board_id,title,author_name,content,media,created_at&board_id=eq.${board}&status=eq.published&order=created_at.desc&limit=120`
    );
    return NextResponse.json({
      posts: rows.map((row) => ({
        author: row.author_name,
        boardId: row.board_id,
        content: row.content,
        createdAt: row.created_at,
        id: row.id,
        imageDataUrl: row.media?.find((media) => media.type?.startsWith("image/"))?.url ?? "",
        imageName: row.media?.[0]?.name ?? "",
        media: row.media ?? [],
        title: row.title
      }))
    });
  } catch (error) {
    if (error instanceof SupabaseConfigError || (error instanceof SupabaseRequestError && error.status === 404)) {
      return NextResponse.json({ posts: [] });
    }
    console.error("Club board posts API error", error);
    return NextResponse.json({ error: "Club board posts are temporarily unavailable." }, { status: 500 });
  }
}
