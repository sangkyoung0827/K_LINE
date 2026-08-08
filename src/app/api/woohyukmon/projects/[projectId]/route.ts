import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeHistoryUserId, patchWoohyukmonProject } from "@/lib/woohyukmonHistory";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  const userId = normalizeHistoryUserId(session?.user?.email);

  if (!userId) {
    return NextResponse.json({ error: "Log in to save your chat history." }, { status: 401 });
  }

  const { projectId } = await context.params;

  try {
    const body = (await request.json()) as {
      description?: unknown;
      isArchived?: unknown;
      title?: unknown;
    };
    const project = await patchWoohyukmonProject({
      description: body.description,
      isArchived: body.isArchived,
      projectId,
      title: body.title,
      userId
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Woohyukmon project update failed", error);
    return NextResponse.json({ error: "Project could not be updated." }, { status: 503 });
  }
}
