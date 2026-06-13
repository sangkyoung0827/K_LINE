import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasSuperAdminAccess } from "@/lib/admin";
import {
  cleanTags,
  cleanText,
  SupabaseConfigError,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type ActivityPostRow = {
  id: string;
  created_at: string;
  title: string;
  category: string | null;
  author_name: string | null;
  email: string | null;
  content: string | null;
  image_url: string | null;
  tags: string[] | null;
  status: string;
};

const tableName = "activity_posts";
const selectedColumns =
  "id,created_at,title,category,author_name,email,content,image_url,tags,status";

function toClientPost(row: ActivityPostRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    category: row.category ?? "",
    authorName: row.author_name ?? "",
    email: row.email ?? "",
    content: row.content ?? "",
    imageUrl: row.image_url ?? "",
    tags: row.tags ?? [],
    status: row.status
  };
}

function apiErrorResponse(error: unknown) {
  console.error("Activity posts API error", error);

  if (error instanceof SupabaseConfigError) {
    return NextResponse.json({ error: "Supabase storage is not configured yet." }, { status: 503 });
  }

  if (error instanceof SupabaseRequestError && error.status === 404) {
    return NextResponse.json(
      { error: "Supabase table activity_posts is not ready yet." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: "Activity post storage is temporarily unavailable." },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const session = await auth();
    const email = session?.user?.email ?? "";

    if (!(await hasSuperAdminAccess(email))) {
      return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
    }

    const rows = await supabaseRequest<ActivityPostRow[]>(
      `${tableName}?select=${selectedColumns}&order=created_at.desc`
    );

    return NextResponse.json({ posts: rows.map(toClientPost) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = cleanText(body.title);
    const authorName = cleanText(body.authorName);
    const email = cleanText(body.email);
    const content = cleanText(body.content, 5000);

    if (!title || !authorName || !email || !content) {
      return NextResponse.json({ error: "Required activity post fields are missing." }, { status: 400 });
    }

    const rows = await supabaseRequest<ActivityPostRow[]>(
      `${tableName}?select=${selectedColumns}`,
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          title,
          category: cleanText(body.category),
          author_name: authorName,
          email,
          content,
          image_url: cleanText(body.imageUrl, 1000),
          tags: cleanTags(body.tags),
          status: "pending"
        })
      }
    );

    return NextResponse.json({ post: rows[0] ? toClientPost(rows[0]) : null }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
