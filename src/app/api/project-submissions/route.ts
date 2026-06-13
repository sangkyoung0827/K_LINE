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

type ProjectSubmissionRow = {
  id: string;
  created_at: string;
  title: string;
  english_title: string | null;
  team_or_author: string | null;
  category: string | null;
  location: string | null;
  short_description: string | null;
  full_description: string | null;
  contact_email: string | null;
  image_url: string | null;
  tags: string[] | null;
  status: string;
};

const tableName = "project_submissions";
const selectedColumns =
  "id,created_at,title,english_title,team_or_author,category,location,short_description,full_description,contact_email,image_url,tags,status";

function toClientSubmission(row: ProjectSubmissionRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    englishTitle: row.english_title ?? "",
    teamOrAuthor: row.team_or_author ?? "",
    category: row.category ?? "",
    location: row.location ?? "",
    shortDescription: row.short_description ?? "",
    fullDescription: row.full_description ?? "",
    contactEmail: row.contact_email ?? "",
    imageUrl: row.image_url ?? "",
    tags: row.tags ?? [],
    status: row.status
  };
}

function apiErrorResponse(error: unknown) {
  console.error("Project submissions API error", error);

  if (error instanceof SupabaseConfigError) {
    return NextResponse.json({ error: "Supabase storage is not configured yet." }, { status: 503 });
  }

  if (error instanceof SupabaseRequestError && error.status === 404) {
    return NextResponse.json(
      { error: "Supabase table project_submissions is not ready yet." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: "Project submission storage is temporarily unavailable." },
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

    const rows = await supabaseRequest<ProjectSubmissionRow[]>(
      `${tableName}?select=${selectedColumns}&order=created_at.desc`
    );

    return NextResponse.json({ submissions: rows.map(toClientSubmission) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = cleanText(body.projectTitle ?? body.title);
    const fullDescription = cleanText(body.fullDescription, 4000);
    const submitterMessage = cleanText(body.message, 1200);

    if (!title || !cleanText(body.shortDescription, 1200) || !fullDescription) {
      return NextResponse.json({ error: "Required project fields are missing." }, { status: 400 });
    }

    const mergedFullDescription = submitterMessage
      ? `${fullDescription}\n\nSubmitter message:\n${submitterMessage}`
      : fullDescription;

    const rows = await supabaseRequest<ProjectSubmissionRow[]>(
      `${tableName}?select=${selectedColumns}`,
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          title,
          english_title: cleanText(body.englishTitle),
          team_or_author: cleanText(body.teamOrAuthor),
          category: cleanText(body.category),
          location: cleanText(body.countryOrCity ?? body.location),
          short_description: cleanText(body.shortDescription, 1200),
          full_description: mergedFullDescription,
          contact_email: cleanText(body.contactEmail),
          image_url: cleanText(body.imageUrl, 1000),
          tags: cleanTags(body.tags),
          status: "pending"
        })
      }
    );

    return NextResponse.json(
      { submission: rows[0] ? toClientSubmission(rows[0]) : null },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
