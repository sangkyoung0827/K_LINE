import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeHistoryUserId, patchWoohyukmonChat } from "@/lib/woohyukmonHistory";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  const userId = normalizeHistoryUserId(session?.user?.email);

  if (!userId) {
    return NextResponse.json({ error: "Log in to save your chat history." }, { status: 401 });
  }

  const { chatId } = await context.params;

  try {
    const body = (await request.json()) as { isArchived?: unknown; title?: unknown };
    const chat = await patchWoohyukmonChat({
      chatId,
      isArchived: body.isArchived,
      title: body.title,
      userId
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }

    return NextResponse.json({ chat });
  } catch (error) {
    console.error("Woohyukmon chat update failed", error);
    return NextResponse.json({ error: "Chat could not be updated." }, { status: 503 });
  }
}
