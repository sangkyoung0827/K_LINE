import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createWoohyukmonMessage,
  getWoohyukmonChatForUser,
  listWoohyukmonMessages,
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

  const chatId = new URL(request.url).searchParams.get("chatId") ?? "";

  if (!chatId) {
    return NextResponse.json({ messages: [] });
  }

  try {
    const messages = await listWoohyukmonMessages(chatId, userId);

    if (!messages) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Woohyukmon messages load failed", error);
    return NextResponse.json({ error: "Messages are temporarily unavailable." }, { status: 503 });
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
      chatId?: unknown;
      content?: unknown;
      model?: unknown;
      providers?: unknown;
      role?: unknown;
      sources?: unknown;
      status?: unknown;
    };
    const chatId = typeof body.chatId === "string" ? body.chatId : "";

    if (!chatId) {
      return NextResponse.json({ error: "chatId is required." }, { status: 400 });
    }

    const chat = await getWoohyukmonChatForUser(chatId, userId);

    if (!chat) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }

    const message = await createWoohyukmonMessage({
      chatId,
      content: body.content,
      model: body.model,
      providers: body.providers,
      role: body.role,
      sources: body.sources,
      status: body.status,
      userId
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Woohyukmon message save failed", error);
    return NextResponse.json({ error: "Message could not be saved." }, { status: 503 });
  }
}
