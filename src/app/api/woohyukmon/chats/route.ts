import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createWoohyukmonChat,
  ensureDefaultWoohyukmonProject,
  getWoohyukmonProjectForUser,
  listWoohyukmonChats,
  normalizeHistoryUserId
} from "@/lib/woohyukmonHistory";

function unauthorized() {
  return NextResponse.json({ error: "Log in to save your chat history." }, { status: 401 });
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = normalizeHistoryUserId(session?.user?.email);

  if (!userId) {
    return unauthorized();
  }

  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";

  if (!projectId) {
    return NextResponse.json({ chats: [] });
  }

  try {
    const project = await getWoohyukmonProjectForUser(projectId, userId);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const chats = await listWoohyukmonChats(projectId, userId);
    return NextResponse.json({ chats });
  } catch (error) {
    console.error("Woohyukmon chats load failed", error);
    return NextResponse.json({ error: "Chat history is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = normalizeHistoryUserId(session?.user?.email);

  if (!userId) {
    return unauthorized();
  }

  try {
    const body = (await request.json()) as {
      firstMessage?: unknown;
      projectId?: unknown;
      title?: unknown;
    };
    const fallbackProjects = await ensureDefaultWoohyukmonProject(userId);
    const requestedProjectId = typeof body.projectId === "string" ? body.projectId : "";
    const project =
      (requestedProjectId ? await getWoohyukmonProjectForUser(requestedProjectId, userId) : null) ??
      fallbackProjects[0];

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const chat = await createWoohyukmonChat({
      firstMessage: body.firstMessage,
      projectId: project.id,
      title: body.title,
      userId
    });

    return NextResponse.json({ chat }, { status: 201 });
  } catch (error) {
    console.error("Woohyukmon chat create failed", error);
    return NextResponse.json({ error: "Chat could not be saved." }, { status: 503 });
  }
}
