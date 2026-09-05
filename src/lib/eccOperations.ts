import "server-only";

import { defaultEccOpenChatUrl } from "@/data/eccRegistration";
import { defaultEccOfficialTeamChatUrl } from "@/lib/eccAccess";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";

type StorageRow = {
  body: string | null;
  id: string;
  title: string | null;
  updated_at: string | null;
};

export type EccOperationalSettings = {
  inquiryChatUrl: string;
  newMemberOpenChatUrl: string;
  officialTeamChatUrl: string;
  periodLabel: string;
  updatedAt: string;
};

export type EccActivityCatalogItem = {
  archived: boolean;
  descriptionEn: string;
  descriptionKo: string;
  id: string;
  sortOrder: number;
  titleEn: string;
  titleKo: string;
};

const table = "ecc_registration_content";
const columns = "id,title,body,updated_at";
const operationsId = "ecc-operations-settings";
const catalogId = "ecc-activity-catalog";
const defaultInquiryChatUrl = "https://open.kakao.com/o/saPt03Nh";

export const defaultEccOperationalSettings: EccOperationalSettings = {
  inquiryChatUrl: defaultInquiryChatUrl,
  newMemberOpenChatUrl: defaultEccOpenChatUrl,
  officialTeamChatUrl: defaultEccOfficialTeamChatUrl,
  periodLabel: "",
  updatedAt: ""
};

export const defaultEccActivityCatalog: EccActivityCatalogItem[] = [
  {
    id: "gathering",
    titleKo: "International Gathering 신청",
    titleEn: "International Gathering Application",
    descriptionKo: "ECC 국제 교류 모임 참여 신청",
    descriptionEn: "Apply for the ECC international gathering",
    sortOrder: 10,
    archived: false
  },
  {
    id: "mt",
    titleKo: "MT 신청",
    titleEn: "MT Application",
    descriptionKo: "ECC MT 참여 신청",
    descriptionEn: "Apply for the ECC MT",
    sortOrder: 20,
    archived: false
  },
  {
    id: "special",
    titleKo: "Special Event 신청",
    titleEn: "Special Event Application",
    descriptionKo: "ECC 특별 이벤트 참여 신청",
    descriptionEn: "Apply for an ECC special event",
    sortOrder: 30,
    archived: false
  },
  {
    id: "opening",
    titleKo: "개강총회 신청",
    titleEn: "Semester Opening Party Application",
    descriptionKo: "ECC 개강총회 참여 신청",
    descriptionEn: "Apply for the ECC semester opening party",
    sortOrder: 40,
    archived: false
  },
  {
    id: "farewell",
    titleKo: "종강총회 신청",
    titleEn: "Farewell Party Application",
    descriptionKo: "ECC 종강총회 참여 신청",
    descriptionEn: "Apply for the ECC farewell party",
    sortOrder: 50,
    archived: false
  },
  {
    id: "english-class",
    titleKo: "English Class 신청",
    titleEn: "English Class Application",
    descriptionKo: "ECC English Class 참여 신청",
    descriptionEn: "Apply for the ECC English Class",
    sortOrder: 60,
    archived: false
  }
];

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
  const rows = await supabaseRequest<StorageRow[]>(
    `${table}?select=${columns}&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows[0] ?? null;
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

export async function getEccOperationalSettings(): Promise<EccOperationalSettings> {
  const row = await getStorageRow(operationsId);
  const stored = parseJson<Partial<EccOperationalSettings>>(row?.body, {});

  return {
    inquiryChatUrl: safeUrl(stored.inquiryChatUrl, defaultEccOperationalSettings.inquiryChatUrl),
    newMemberOpenChatUrl: safeUrl(stored.newMemberOpenChatUrl, defaultEccOperationalSettings.newMemberOpenChatUrl),
    officialTeamChatUrl: safeUrl(stored.officialTeamChatUrl, defaultEccOperationalSettings.officialTeamChatUrl),
    periodLabel: cleanText(stored.periodLabel, 120),
    updatedAt: row?.updated_at ?? ""
  };
}

export function cleanEccOperationalSettings(input: Record<string, unknown>): EccOperationalSettings {
  return {
    inquiryChatUrl: safeUrl(input.inquiryChatUrl, defaultEccOperationalSettings.inquiryChatUrl),
    newMemberOpenChatUrl: safeUrl(input.newMemberOpenChatUrl, defaultEccOperationalSettings.newMemberOpenChatUrl),
    officialTeamChatUrl: safeUrl(input.officialTeamChatUrl, defaultEccOperationalSettings.officialTeamChatUrl),
    periodLabel: cleanText(input.periodLabel, 120),
    updatedAt: ""
  };
}

export async function saveEccOperationalSettings(
  settings: EccOperationalSettings,
  updatedBy: string
) {
  const row = await saveStorageRow({
    id: operationsId,
    title: settings.periodLabel || "ECC Operations",
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
  input: Partial<EccActivityCatalogItem>,
  fallbackSortOrder: number
): EccActivityCatalogItem | null {
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

export async function getEccActivityCatalog(options?: { includeArchived?: boolean }) {
  const row = await getStorageRow(catalogId);
  const stored = parseJson<EccActivityCatalogItem[]>(row?.body, defaultEccActivityCatalog);
  const cleaned = stored
    .map((item, index) => cleanCatalogItem(item, (index + 1) * 10))
    .filter((item): item is EccActivityCatalogItem => Boolean(item))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  const catalog = cleaned.length ? cleaned : defaultEccActivityCatalog;

  return options?.includeArchived ? catalog : catalog.filter((item) => !item.archived);
}

async function saveEccActivityCatalog(catalog: EccActivityCatalogItem[], updatedBy: string) {
  const normalized = catalog
    .map((item, index) => cleanCatalogItem(item, (index + 1) * 10))
    .filter((item): item is EccActivityCatalogItem => Boolean(item))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  await saveStorageRow({
    id: catalogId,
    title: "ECC Activity Catalog",
    body: JSON.stringify(normalized),
    updatedBy
  });

  return normalized;
}

export async function createEccActivityCatalogItem(
  input: Record<string, unknown>,
  updatedBy: string
) {
  const catalog = await getEccActivityCatalog({ includeArchived: true });
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
    throw new Error("A valid ECC activity title is required.");
  }

  await saveEccActivityCatalog([...catalog, item], updatedBy);
  return item;
}

export async function updateEccActivityCatalogItem(
  id: string,
  input: Record<string, unknown>,
  updatedBy: string
) {
  const catalog = await getEccActivityCatalog({ includeArchived: true });
  const index = catalog.findIndex((item) => item.id === id);

  if (index < 0) return null;

  const current = catalog[index];
  const updated = cleanCatalogItem(
    {
      ...current,
      titleKo: input.titleKo ?? current.titleKo,
      titleEn: input.titleEn ?? current.titleEn,
      descriptionKo: input.descriptionKo ?? current.descriptionKo,
      descriptionEn: input.descriptionEn ?? current.descriptionEn,
      sortOrder: input.sortOrder ?? current.sortOrder,
      archived: input.archived ?? current.archived
    },
    current.sortOrder
  );

  if (!updated) return null;
  catalog[index] = updated;
  await saveEccActivityCatalog(catalog, updatedBy);
  return updated;
}

export async function archiveEccActivityCatalogItem(id: string, updatedBy: string) {
  return updateEccActivityCatalogItem(id, { archived: true }, updatedBy);
}
