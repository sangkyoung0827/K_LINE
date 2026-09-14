import "server-only";

import { getHanhwalOfficialTeamChatUrl } from "@/lib/hanhwalAccess";
import {
  cleanText,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";

type HanhwalOperationalSettingsRow = {
  id: string;
  official_team_chat_url: string | null;
  period_label: string | null;
  updated_at: string | null;
};

export type HanhwalOperationalSettings = {
  officialTeamChatUrl: string;
  periodLabel: string;
  updatedAt: string;
};

const table = "hanhwal_operational_settings";
const settingsId = "current";
const columns = "id,official_team_chat_url,period_label,updated_at";

export function defaultHanhwalOperationalSettings(): HanhwalOperationalSettings {
  return {
    officialTeamChatUrl: getHanhwalOfficialTeamChatUrl(),
    periodLabel: "",
    updatedAt: ""
  };
}

function safeUrl(value: unknown, fallback: string) {
  const text = cleanText(value, 1000);
  if (!text) return fallback;

  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : fallback;
  } catch {
    return fallback;
  }
}

export async function getHanhwalOperationalSettings(): Promise<HanhwalOperationalSettings> {
  const fallback = defaultHanhwalOperationalSettings();

  try {
    const rows = await supabaseRequest<HanhwalOperationalSettingsRow[]>(
      `${table}?select=${columns}&id=eq.${settingsId}&limit=1`
    );
    const row = rows[0];

    if (!row) return fallback;

    return {
      officialTeamChatUrl: safeUrl(row.official_team_chat_url, fallback.officialTeamChatUrl),
      periodLabel: cleanText(row.period_label, 120),
      updatedAt: row.updated_at ?? ""
    };
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.status === 404) {
      return fallback;
    }

    throw error;
  }
}

export function cleanHanhwalOperationalSettings(
  input: Record<string, unknown>,
  fallback = defaultHanhwalOperationalSettings()
): HanhwalOperationalSettings {
  return {
    officialTeamChatUrl: safeUrl(input.officialTeamChatUrl, fallback.officialTeamChatUrl),
    periodLabel: cleanText(input.periodLabel, 120),
    updatedAt: ""
  };
}

export async function saveHanhwalOperationalSettings(
  settings: HanhwalOperationalSettings,
  updatedBy: string
) {
  const rows = await supabaseRequest<HanhwalOperationalSettingsRow[]>(
    `${table}?on_conflict=id&select=${columns}`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: settingsId,
        official_team_chat_url: settings.officialTeamChatUrl,
        period_label: settings.periodLabel,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      })
    }
  );

  return {
    ...settings,
    updatedAt: rows[0]?.updated_at ?? new Date().toISOString()
  };
}
