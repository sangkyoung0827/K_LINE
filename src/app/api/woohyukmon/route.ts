import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildWoohyukmonContext } from "@/lib/woohyukmonContext";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

const systemPrompt = `You are 우혁몬, the core AI assistant for the K_LINE website. K_LINE is a campus-based K-culture platform for university students, especially international students and student communities. The site has three main tracks: Goods, K-Culture Project, and International Clubs. Goods includes Hanji Calligraphy LED Light Object and Arrow Pen. K-Culture Project includes Korean cultural project sharing and the project ‘한국의 선, 유럽을 잇다 / Connecting Korean Lines to Europe.’ International Clubs includes ECC and Han-hwal club records. ECC is an English Conversation Club for Korean and international student exchange, with an ECC menu for the free board, activity management, and fund management. Han-hwal is a Korean traditional archery community described as ‘우리는 국궁으로 심신을 수련하는 한활입니다.’ Use the provided K_LINE knowledge base and site data first. Answer in the same language as the user. Be friendly, concise, accurate, and helpful. Do not invent facts. If the information is not available, say so and guide the user to the relevant page or Contact.`;

function cleanMessages(history: unknown): ClientMessage[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((message): message is ClientMessage => {
      if (!message || typeof message !== "object") {
        return false;
      }
      const candidate = message as Partial<ClientMessage>;
      return (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string" &&
        candidate.content.trim().length > 0
      );
    })
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 900)
    }));
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not configured yet. Please add it locally or in Vercel Environment Variables."
      },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as { message?: unknown; history?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });
    const context = buildWoohyukmonContext();
    const history = cleanMessages(body.history);

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 420,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "system",
          content: `Use this compact K_LINE context before answering:\n\n${context}`
        },
        ...history,
        { role: "user", content: message.slice(0, 1200) }
      ]
    });

    const answer = response.choices[0]?.message?.content?.trim();

    if (!answer) {
      return NextResponse.json(
        { error: "Woohyukmon could not generate an answer. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Woohyukmon API error", error);
    return NextResponse.json(
      {
        error:
          "Woohyukmon is temporarily unavailable. Please try again later or use the Contact page."
      },
      { status: 500 }
    );
  }
}
