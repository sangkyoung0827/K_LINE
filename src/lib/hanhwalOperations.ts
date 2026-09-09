import "server-only";
import { defaultHanhwalActivityCatalog } from "@/data/hanhwalActivityCatalog";

import { defaultHanhwalOpenChatUrl } from "@/data/hanhwalRegistration";
import { defaultHanhwalOfficialTeamChatUrl } from "@/lib/hanhwalAccess";
import { cleanText, supabaseRequest, SupabaseRequestError } from "@/lib/supabaseServer";

type StorageRow = {
  body: string | null;
  id: string;
  title: string | null;
  updated_at: string | null;
};

export type HanhwalOperationalSettings = {
  inquiryChatUrl: string;
  newMemberOpenChatUrl: string;
  officialTeamChatUrl: string;
  periodLabel: string;
  updatedAt: string;
};

export type HanhwalActivityCatalogItem = {
  archived: boolean;
  descriptionEn: string;
  descriptionKo: string;
  id: string;
  sortOrder: number;
  titleEn: string;
  titleKo: string;
};

const table = "hanhwal_registration_content";
const columns = "id,title,body,updated_at";
const operationsId = "hanhwal-operations-settings";
const catalogId = "hanhwal-activity-catalog";
const defaultInquiryChatUrl = process.env.HANHWAL_INQUIRY_CHAT_URL?.trim() || "";

export const defaultHanhwalOperationalSettings: HanhwalOperationalSettings = {
  inquiryChatUrl: defaultInquiryChatUrl,
  newMemberOpenChatUrl: process.env.HANHWAL_OPEN_CHAT_URL?.trim() || defaultHanhwalOpenChatUrl,
  officialTeamChatUrl: process.env.HANHWAL_OFFICIAL_TEAM_CHAT_URL?.trim() || defaultHanhwalOfficialTeamChatUrl,
  periodLabel: "",
  updatedAt: ""
};

export { defaultHanhwalActivityCatalog } from "@/data/hanhwalActivityCatalog";

function safeUrl(value: unknown, fallback: string) {
  const text = cleanText(value, 1000);
  if (!text) return fallback;

  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function getStorageRow(id: string) {
  try {
  const rows = await supabaseRequest<StorageRow[]>(
    `${table}?select=${columns}&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] ?? null;
  } catch (error) {
    // Preserve existing registration/activity reads during the additive rollout.
    if (error instanceof SupabaseRequestError && error.status === 404) return null;
    throw error;
  }
}

async function saveStorageRow(input: {
  body: string;
  id: string;
  title: string;
  updatedBy: string;
}) {
  const rows = await supabaseRequest<StorageRow[]>(
    `${table}?on_conflict=id&select=${columns}`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: input.id,
        title: input.title,
        body: input.body,
        updated_by: input.updatedBy,
        updated_at: new Date().toISOString()
      })
    }
  );
  return rows[0] ?? null;
}

export async function getHanhwalOperationalSettings(): Promise<HanhwalOperationalSettings> {
  const row = await getStorageRow(operationsId);
  const stored = parseJson<Partial<HanhwalOperationalSettings>>(row?.body, {});

  return {
    inquiryChatUrl: safeUrl(stored.inquiryChatUrl, defaultHanhwalOperationalSettings.inquiryChatUrl),
    newMemberOpenChatUrl: safeUrl(stored.newMemberOpenChatUrl, defaultHanhwalOperationalSettings.newMemberOpenChatUrl),
    officialTeamChatUrl: safeUrl(stored.officialTeamChatUrl, defaultHanhwalOperationalSettings.officialTeamChatUrl),
    periodLabel: cleanText(stored.periodLabel, 120),
    updatedAt: row?.updated_at ?? ""
  };
}

export function cleanHanhwalOperationalSettings(input: Record<string, unknown>): HanhwalOperationalSettings {
  return {
    inquiryChatUrl: safeUrl(input.inquiryChatUrl, defaultHanhwalOperationalSettings.inquiryChatUrl),
    newMemberOpenChatUrl: safeUrl(input.newMemberOpenChatUrl, defaultHanhwalOperationalSettings.newMemberOpenChatUrl),
    officialTeamChatUrl: safeUrl(input.officialTeamChatUrl, defaultHanhwalOperationalSettings.officialTeamChatUrl),
    periodLabel: cleanText(input.periodLabel, 120),
    updatedAt: ""
  };
}

export async function saveHanhwalOperationalSettings(
  settings: HanhwalOperationalSettings,
  updatedBy: string
) {
  const row = await saveStorageRow({
    id: operationsId,
    title: settings.periodLabel || "HANHWAL Operations",
    body: JSON.stringify({
      inquiryChatUrl: settings.inquiryChatUrl,
      newMemberOpenChatUrl: settings.newMemberOpenChatUrl,
      officialTeamChatUrl: settings.officialTeamChatUrl,
      periodLabel: settings.periodLabel
    }),
    updatedBy
  });

  return {
    ...settings,
    updatedAt: row?.updated_at ?? new Date().toISOString()
  };
}

function cleanActivityId(value: unknown) {
  return cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function cleanCatalogItem(
  input: Partial<HanhwalActivityCatalogItem>,
  fallbackSortOrder: number
): HanhwalActivityCatalogItem | null {
  const id = cleanActivityId(input.id);
  const titleKo = cleanText(input.titleKo, 160);
  const titleEn = cleanText(input.titleEn, 160);

  if (!id || (!titleKo && !titleEn)) {
    return null;
  }

  return {
    id,
    titleKo: titleKo || titleEn,
    titleEn: titleEn || titleKo,
    descriptionKo: cleanText(input.descriptionKo, 300),
    descriptionEn: cleanText(input.descriptionEn, 300),
    sortOrder: Number.isFinite(Number(input.sortOrder))
      ? Number(input.sortOrder)
      : fallbackSortOrder,
    archived: Boolean(input.archived)
  };
}

export async function getHanhwalActivityCatalog(options?: { includeArchived?: boolean }) {
  const row = await getStorageRow(catalogId);
  const stored = parseJson<HanhwalActivityCatalogItem[]>(row?.body, defaultHanhwalActivityCatalog);
  const cleaned = stored
    .map((item, index) => cleanCatalogItem(item, (index + 1) * 10))
    .filter((item): item is HanhwalActivityCatalogItem => Boolean(item))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  const catalog = cleaned.length ? cleaned : defaultHanhwalActivityCatalog;

  return options?.includeArchived ? catalog : catalog.filter((item) => !item.archived);
}

async function saveHanhwalActivityCatalog(catalog: HanhwalActivityCatalogItem[], updatedBy: string) {
  const normalized = catalog
    .map((item, index) => cleanCatalogItem(item, (index + 1) * 10))
    .filter((item): item is HanhwalActivityCatalogItem => Boolean(item))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  await saveStorageRow({
    id: catalogId,
    title: "HANHWAL Activity Catalog",
    body: JSON.stringify(normalized),
    updatedBy
  });

  return normalized;
}

export async function createHanhwalActivityCatalogItem(
  input: Record<string, unknown>,
  updatedBy: string
) {
  const catalog = await getHanhwalActivityCatalog({ includeArchived: true });
  const baseId =
    cleanActivityId(input.id) ||
    cleanActivityId(input.titleEn) ||
    cleanActivityId(input.titleKo) ||
    "activity";
  let id = baseId;
  let suffix = 2;

  while (catalog.some((item) => item.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const item = cleanCatalogItem(
    {
      id,
      titleKo: cleanText(input.titleKo, 160),
      titleEn: cleanText(input.titleEn, 160),
      descriptionKo: cleanText(input.descriptionKo, 300),
      descriptionEn: cleanText(input.descriptionEn, 300),
      sortOrder: (catalog.at(-1)?.sortOrder ?? 0) + 10,
      archived: false
    },
    (catalog.length + 1) * 10
  );

  if (!item) {
    throw new Error("A valid HANHWAL activity title is required.");
  }

  await saveHanhwalActivityCatalog([...catalog, item], updatedBy);
  return item;
}

export async function updateHanhwalActivityCatalogItem(
  id: string,
  input: Record<string, unknown>,
  updatedBy: string
) {
  const catalog = await getHanhwalActivityCatalog({ includeArchived: true });
  const index = catalog.findIndex((item) => item.id === id);

  if (index < 0) return null;

  const current = catalog[index];
  const titleKo =
    typeof input.titleKo === "string" ? input.titleKo : current.titleKo;
  const titleEn =
    typeof input.titleEn === "string" ? input.titleEn : current.titleEn;
  const descriptionKo =
    typeof input.descriptionKo === "string"
      ? input.descriptionKo
      : current.descriptionKo;
  const descriptionEn =
    typeof input.descriptionEn === "string"
      ? input.descriptionEn
      : current.descriptionEn;
  const sortOrder =
    typeof input.sortOrder === "number" || typeof input.sortOrder === "string"
      ? Number(input.sortOrder)
      : current.sortOrder;
  const archived =
    typeof input.archived === "boolean" ? input.archived : current.archived;

  const updated = cleanCatalogItem(
    {
      ...current,
      titleKo,
      titleEn,
      descriptionKo,
      descriptionEn,
      sortOrder,
      archived
    },
    current.sortOrder
  );

  if (!updated) return null;
  catalog[index] = updated;
  await saveHanhwalActivityCatalog(catalog, updatedBy);
  return updated;
}

export async function archiveHanhwalActivityCatalogItem(id: string, updatedBy: string) {
  return updateHanhwalActivityCatalogItem(id, { archived: true }, updatedBy);
}
