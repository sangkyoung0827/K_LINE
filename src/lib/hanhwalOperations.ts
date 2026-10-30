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
  team_chat_description_ko?: string | null;
  team_chat_description_en?: string | null;
  updated_at: string | null;
};

export type HanhwalOperationalSettings = {
  officialTeamChatUrl: string;
  periodLabel: string;
  teamChatDescriptionKo: string;
  teamChatDescriptionEn: string;
  updatedAt: string;
};

const table = "hanhwal_operational_settings";
const settingsId = "current";
const columns = "id,official_team_chat_url,period_label,team_chat_description_ko,team_chat_description_en,updated_at";

export function defaultHanhwalOperationalSettings(): HanhwalOperationalSettings {
  return {
    officialTeamChatUrl: getHanhwalOfficialTeamChatUrl(),
    periodLabel: "",
    teamChatDescriptionKo: "등록한 이름 또는 카카오톡 표시 이름으로 입장해 주세요.",
    teamChatDescriptionEn: "Please join using your registered name or KakaoTalk display name.",
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
    let rows: HanhwalOperationalSettingsRow[];
    try {
      rows = await supabaseRequest<HanhwalOperationalSettingsRow[]>(
        `${table}?select=${columns}&id=eq.${settingsId}&limit=1`
      );
    } catch (error) {
      // Keep existing links readable while the additive description migration rolls out.
      if (!(error instanceof SupabaseRequestError) || error.status !== 400 ||
        !/team_chat_description_(ko|en)/.test(error.message)) throw error;
      rows = await supabaseRequest<HanhwalOperationalSettingsRow[]>(
        `${table}?select=id,official_team_chat_url,period_label,updated_at&id=eq.${settingsId}&limit=1`
      );
    }
    const row = rows[0];

    if (!row) return fallback;

    return {
      officialTeamChatUrl: safeUrl(row.official_team_chat_url, fallback.officialTeamChatUrl),
      periodLabel: cleanText(row.period_label, 120),
      teamChatDescriptionKo: row.team_chat_description_ko == null ? fallback.teamChatDescriptionKo : cleanText(row.team_chat_description_ko, 2000),
      teamChatDescriptionEn: row.team_chat_description_en == null ? fallback.teamChatDescriptionEn : cleanText(row.team_chat_description_en, 2000),
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
    teamChatDescriptionKo: typeof input.teamChatDescriptionKo === "string" ? cleanText(input.teamChatDescriptionKo, 2000) : fallback.teamChatDescriptionKo,
    teamChatDescriptionEn: typeof input.teamChatDescriptionEn === "string" ? cleanText(input.teamChatDescriptionEn, 2000) : fallback.teamChatDescriptionEn,
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
        team_chat_description_ko: settings.teamChatDescriptionKo,
        team_chat_description_en: settings.teamChatDescriptionEn,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      })
    }
  );

  if (!rows[0]) throw new Error("Hanhwal operations were not saved.");
  return {
    ...settings,
    updatedAt: rows[0]?.updated_at ?? new Date().toISOString()
  };
}
