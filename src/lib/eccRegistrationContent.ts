import "server-only";

import {
  defaultEccRegistrationContent,
  type EccRegistrationContent
} from "@/data/eccRegistrationContent";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";

type EccRegistrationContentRow = {
  body: string | null;
  id: string;
  title: string | null;
  updated_at: string | null;
};

const contentId = "ecc-new-member-registration";
const columns = "id,title,body,updated_at";
const table = "ecc_registration_content";

function cleanBody(value: unknown) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, 10_000) : "";
}

function toContent(row: EccRegistrationContentRow): EccRegistrationContent {
  return {
    body: row.body ?? defaultEccRegistrationContent.body,
    title: row.title ?? defaultEccRegistrationContent.title,
    updatedAt: row.updated_at ?? ""
  };
}

export function cleanEccRegistrationContent(input: Record<string, unknown>) {
  return {
    body: cleanBody(input.body),
    title: cleanText(input.title, 180)
  };
}

export async function getEccRegistrationContent() {
  const rows = await supabaseRequest<EccRegistrationContentRow[]>(
    `${table}?select=${columns}&id=eq.${encodeURIComponent(contentId)}&limit=1`
  );

  return rows[0] ? toContent(rows[0]) : defaultEccRegistrationContent;
}

export async function saveEccRegistrationContent(input: {
  body: string;
  title: string;
  updatedBy: string;
}) {
  const rows = await supabaseRequest<EccRegistrationContentRow[]>(
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
