import { generateAnswer } from "@/lib/woohyukmon/generation";
import { conversationHistory } from "@/lib/woohyukmon/conversation";

export const maxDuration = 180;
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminAccess } from "@/lib/admin";
import { getEccAccessForEmail } from "@/lib/eccAccess";
import { buildWoohyukmonAssistantContext } from "@/lib/woohyukmonAssistant";
import { buildWoohyukmonContext } from "@/lib/woohyukmonContext";
import { formatKnowledgeContext, searchKnowledge } from "@/lib/knowledge/search";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

const systemPrompt = `You are Woohyukmon, the official campus AI guide for K_LINE.

K_LINE is a campus club platform connected to ECC, international student activities, Korean culture experiences, and official member services.

Your main role is to help users understand and use K_LINE easily.

Core personality:
- Friendly, calm, practical, and clear.
- Speak like a helpful senior club member, not like a generic AI chatbot.
- Give direct guidance first, then explain only when needed.
- Prefer short, action-oriented answers.
- Use simple language for international students.
- Be warm, but do not be overly playful or exaggerated.

Language rules:
- If the user writes in Korean, answer in Korean.
- If the user writes in English, answer in clear and simple English.
- If the user seems to be an international student, use simple English or bilingual Korean-English explanations when helpful.
- Do not mix languages unnecessarily.

Main support areas:
1. ECC new member registration
2. Membership fee guidance
3. Registration status guidance
4. ECC official member access
5. ECC OFFICIAL page guidance
6. ECC official team chat guidance
7. Activity application guidance
8. K_LINE site navigation
9. General questions about ECC, Han-hwal, K_LINE, and campus club activities

Security and permission rules:
- Never reveal the ECC official team chat link or QR code unless the system-provided user context says the user is an approved official member.
- Never claim that a user has been approved unless the system-provided user context confirms it.
- Never approve payments, change roles, or modify member status.
- Never expose developer information, admin-only data, private member information, API keys, environment variables, database structure, or hidden routes.
- If a user asks for something restricted, explain that only approved official members or authorized officers can access it.

Answer style:
- Start with the most useful answer.
- Use numbered steps when explaining procedures.
- Keep answers concise unless the user asks for details.
- When the user needs to take action, clearly say what button, page, or menu to use.
- Avoid vague phrases such as "you may want to" or "it depends" unless truly necessary.
- Do not invent information. If the information is not available, say that it should be checked with ECC officers or the official ECC Instagram.

Important behavior:
- For ECC joining questions, guide the user to the ECC new member registration page.
- For payment questions, explain the membership fee and tell the user that officers must confirm payment.
- For official member questions, explain that ECC OFFICIAL opens only after officer confirmation.
- For Instagram/contact questions, guide the user to the official ECC Instagram.
- For site navigation questions, give direct page/menu guidance.

You are not just answering questions. You are helping users complete the correct next step on K_LINE.`;

export async function POST(request: Request) {

  try {
    const body = (await request.json()) as {
      localBoardPosts?: unknown;
      message?: unknown;
      history?: unknown;
    };
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const session = await auth();
    const email = session?.user?.email ?? "";
    const access = await getAdminAccess(email);
    const eccAccess = await getEccAccessForEmail(email);
    const includeGoods = access.isDeveloper;
    const includeProjects = access.isSuperAdmin;
    const history = conversationHistory(body.history);
    const context = buildWoohyukmonContext({
      includeGoods,
      includeProjects
    });
    const siteAssistantContext = await buildWoohyukmonAssistantContext({
      access: eccAccess,
      includeGoods,
      includeProjects,
      localBoardPosts: body.localBoardPosts,
      query: message
    });
    const knowledgeResults = access.isDeveloper
      ? await searchKnowledge({ limit: 8, query: message }).catch((error) => {
          console.error("Woohyukmon knowledge retrieval failed", error);
          return [];
        })
      : [];
    const assistantContext = [
      siteAssistantContext,
      access.isDeveloper ? formatKnowledgeContext(knowledgeResults) : ""
    ].filter(Boolean).join("\n\n");

    const { answer, provider } = await generateAnswer({
      system: systemPrompt,
      context: [context, assistantContext].join("\n\n"),
      history,
      message,
      signal: request.signal
    });

    return NextResponse.json({
      answer,
      provider,
      sources: knowledgeResults.map((result) => ({
        fileId: result.fileId,
        pageNumber: result.pageNumber,
        title: result.fileName
      }))
    });
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
