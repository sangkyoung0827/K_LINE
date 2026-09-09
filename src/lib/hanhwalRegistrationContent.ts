import "server-only";

import {
  defaultHanhwalRegistrationContent,
  type HanhwalRegistrationContent
} from "@/data/hanhwalRegistrationContent";
import { cleanText, supabaseRequest, SupabaseRequestError } from "@/lib/supabaseServer";

type HanhwalRegistrationContentRow = {
  body: string | null;
  id: string;
  title: string | null;
  updated_at: string | null;
};

const contentId = "hanhwal-new-member-registration";
const columns = "id,title,body,updated_at";
const table = "hanhwal_registration_content";

function cleanBody(value: unknown) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, 10_000) : "";
}

function toContent(row: HanhwalRegistrationContentRow): HanhwalRegistrationContent {
  return {
    body: row.body ?? defaultHanhwalRegistrationContent.body,
    title: row.title ?? defaultHanhwalRegistrationContent.title,
    updatedAt: row.updated_at ?? ""
  };
}

export function cleanHanhwalRegistrationContent(input: Record<string, unknown>) {
  return {
    body: cleanBody(input.body),
    title: cleanText(input.title, 180)
  };
}

export async function getHanhwalRegistrationContent() {
  try {
  const rows = await supabaseRequest<HanhwalRegistrationContentRow[]>(
    `${table}?select=${columns}&id=eq.${encodeURIComponent(contentId)}&limit=1`
  );

  return rows[0] ? toContent(rows[0]) : defaultHanhwalRegistrationContent;
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.status === 404) {
      return defaultHanhwalRegistrationContent;
    }
    throw error;
  }
}

export async function saveHanhwalRegistrationContent(input: {
  body: string;
  title: string;
  updatedBy: string;
}) {
  const rows = await supabaseRequest<HanhwalRegistrationContentRow[]>(
    `${table}?on_conflict=id&select=${columns}`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        body: input.body,
        id: contentId,
        title: input.title,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy
      })
    }
  );

  return rows[0] ? toContent(rows[0]) : null;
}
