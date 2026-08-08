import "server-only";

import { cleanText, supabaseRequest } from "@/lib/supabaseServer";

export type WoohyukmonProjectRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
};

export type WoohyukmonChatRow = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  is_archived: boolean;
};

export type WoohyukmonMessageRow = {
  id: string;
  chat_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: unknown;
  providers: unknown;
  status: string | null;
  model: string | null;
  created_at: string;
};

const projectColumns =
  "id,user_id,title,description,created_at,updated_at,is_archived";
const chatColumns =
  "id,project_id,user_id,title,created_at,updated_at,last_message_at,is_archived";
const messageColumns =
  "id,chat_id,user_id,role,content,sources,providers,status,model,created_at";

export function normalizeHistoryUserId(email?: string | null) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function makeChatTitle(message: unknown) {
  const cleaned = cleanText(message, 80)
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim();

  if (!cleaned) {
    return "New Chat";
  }

  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}...` : cleaned;
}

export async function listWoohyukmonProjects(userId: string) {
  return supabaseRequest<WoohyukmonProjectRow[]>(
    `woohyukmon_projects?select=${projectColumns}&user_id=eq.${encodeURIComponent(
      userId
    )}&is_archived=eq.false&order=updated_at.desc&limit=100`
  );
}

export async function createWoohyukmonProject(input: {
  description?: unknown;
  title: unknown;
  userId: string;
}) {
  const now = new Date().toISOString();
  const rows = await supabaseRequest<WoohyukmonProjectRow[]>(
    `woohyukmon_projects?select=${projectColumns}`,
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        created_at: now,
        description: cleanText(input.description, 400) || null,
        is_archived: false,
        title: cleanText(input.title, 120) || "General",
        updated_at: now,
        user_id: input.userId
      })
    }
  );

  return rows[0] ?? null;
}

export async function ensureDefaultWoohyukmonProject(userId: string) {
  const existing = await listWoohyukmonProjects(userId);

  if (existing.length > 0) {
    return existing;
  }

  const created = await createWoohyukmonProject({
    title: "General",
    description: "Default Woohyukmon project",
    userId
  });

  return created ? [created] : [];
}

export async function getWoohyukmonProjectForUser(projectId: string, userId: string) {
  const rows = await supabaseRequest<WoohyukmonProjectRow[]>(
    `woohyukmon_projects?select=${projectColumns}&id=eq.${encodeURIComponent(
      projectId
    )}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );

  return rows[0] ?? null;
}

export async function patchWoohyukmonProject(input: {
  description?: unknown;
  isArchived?: unknown;
  projectId: string;
  title?: unknown;
  userId: string;
}) {
  const body: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (input.title !== undefined) body.title = cleanText(input.title, 120) || "Untitled Project";
  if (input.description !== undefined) body.description = cleanText(input.description, 400) || null;
  if (input.isArchived !== undefined) body.is_archived = Boolean(input.isArchived);

  const rows = await supabaseRequest<WoohyukmonProjectRow[]>(
    `woohyukmon_projects?id=eq.${encodeURIComponent(
      input.projectId
    )}&user_id=eq.${encodeURIComponent(input.userId)}&select=${projectColumns}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body)
    }
  );

  return rows[0] ?? null;
}

export async function listWoohyukmonChats(projectId: string, userId: string) {
  return supabaseRequest<WoohyukmonChatRow[]>(
    `woohyukmon_chats?select=${chatColumns}&project_id=eq.${encodeURIComponent(
      projectId
    )}&user_id=eq.${encodeURIComponent(
      userId
    )}&is_archived=eq.false&order=last_message_at.desc&limit=100`
  );
}

export async function createWoohyukmonChat(input: {
  firstMessage?: unknown;
  projectId: string;
  title?: unknown;
  userId: string;
}) {
  const now = new Date().toISOString();
  const rows = await supabaseRequest<WoohyukmonChatRow[]>(
    `woohyukmon_chats?select=${chatColumns}`,
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        created_at: now,
        is_archived: false,
        last_message_at: now,
        project_id: input.projectId,
        title: cleanText(input.title, 120) || makeChatTitle(input.firstMessage),
        updated_at: now,
        user_id: input.userId
      })
    }
  );

  await touchWoohyukmonProject(input.projectId, input.userId).catch(() => null);
  return rows[0] ?? null;
}

export async function getWoohyukmonChatForUser(chatId: string, userId: string) {
  const rows = await supabaseRequest<WoohyukmonChatRow[]>(
    `woohyukmon_chats?select=${chatColumns}&id=eq.${encodeURIComponent(
      chatId
    )}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );

  return rows[0] ?? null;
}

export async function patchWoohyukmonChat(input: {
  chatId: string;
  isArchived?: unknown;
  title?: unknown;
  userId: string;
}) {
  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    updated_at: now
  };

  if (input.title !== undefined) body.title = cleanText(input.title, 120) || "Untitled Chat";
  if (input.isArchived !== undefined) body.is_archived = Boolean(input.isArchived);

  const rows = await supabaseRequest<WoohyukmonChatRow[]>(
    `woohyukmon_chats?id=eq.${encodeURIComponent(
      input.chatId
    )}&user_id=eq.${encodeURIComponent(input.userId)}&select=${chatColumns}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body)
    }
  );

  return rows[0] ?? null;
}

export async function listWoohyukmonMessages(chatId: string, userId: string) {
  const chat = await getWoohyukmonChatForUser(chatId, userId);

  if (!chat) {
    return null;
  }

  return supabaseRequest<WoohyukmonMessageRow[]>(
    `woohyukmon_messages?select=${messageColumns}&chat_id=eq.${encodeURIComponent(
      chatId
    )}&user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=200`
  );
}

export async function createWoohyukmonMessage(input: {
  chatId: string;
  content: unknown;
  model?: unknown;
  providers?: unknown;
  role: unknown;
  sources?: unknown;
  status?: unknown;
  userId: string;
}) {
  const role =
    input.role === "assistant" || input.role === "system" || input.role === "user"
      ? input.role
      : "user";
  const now = new Date().toISOString();
  const rows = await supabaseRequest<WoohyukmonMessageRow[]>(
    `woohyukmon_messages?select=${messageColumns}`,
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        chat_id: input.chatId,
        content: cleanText(input.content, 12000),
        created_at: now,
        model: cleanText(input.model, 120) || null,
        providers: Array.isArray(input.providers) ? input.providers.slice(0, 12) : null,
        role,
        sources: Array.isArray(input.sources) ? input.sources.slice(0, 20) : null,
        status: cleanText(input.status, 240) || null,
        user_id: input.userId
      })
    }
  );

  await touchWoohyukmonChat(input.chatId, input.userId).catch(() => null);
  return rows[0] ?? null;
}

async function touchWoohyukmonProject(projectId: string, userId: string) {
  await supabaseRequest<null>(
    `woohyukmon_projects?id=eq.${encodeURIComponent(
      projectId
    )}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ updated_at: new Date().toISOString() })
    }
  );
}

async function touchWoohyukmonChat(chatId: string, userId: string) {
  const now = new Date().toISOString();
  const chat = await getWoohyukmonChatForUser(chatId, userId);

  await supabaseRequest<null>(
    `woohyukmon_chats?id=eq.${encodeURIComponent(
      chatId
    )}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_message_at: now, updated_at: now })
    }
  );

  if (chat?.project_id) {
    await touchWoohyukmonProject(chat.project_id, userId);
  }
}
