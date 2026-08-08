import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createWoohyukmonProject,
  ensureDefaultWoohyukmonProject,
  normalizeHistoryUserId
} from "@/lib/woohyukmonHistory";

function unauthorized() {
  return NextResponse.json({ error: "Log in to save your chat history." }, { status: 401 });
}

export async function GET() {
  const session = await auth();
  const userId = normalizeHistoryUserId(session?.user?.email);

  if (!userId) {
    return unauthorized();
  }

  try {
    const projects = await ensureDefaultWoohyukmonProject(userId);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Woohyukmon projects load failed", error);
    return NextResponse.json({ error: "Saved conversations are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = normalizeHistoryUserId(session?.user?.email);

  if (!userId) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as { description?: unknown; title?: unknown };
    const project = await createWoohyukmonProject({
      description: body.description,
      title: body.title || "New Project",
      userId
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Woohyukmon project create failed", error);
    return NextResponse.json({ error: "Project could not be saved." }, { status: 503 });
  }
}
