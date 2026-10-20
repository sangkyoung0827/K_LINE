export const maxResourceBytes = 50 * 1024 * 1024;

export const resourceCategories = [
  { id: "class-research", ko: "수업·연구 자료", en: "Class & research" },
  { id: "notice", ko: "공지문", en: "Notices" },
  { id: "mt", ko: "MT 관련 자료", en: "MT materials" },
  { id: "special-event", ko: "스페셜 이벤트 관련 자료", en: "Special events" },
  { id: "other", ko: "기타", en: "Other" }
] as const;

export const hanhwalResourceCategories = [
  { id: "archery", ko: "활쏘기 교육", en: "Archery training" },
  { id: "research", ko: "연구 자료", en: "Research" },
  { id: "photos", ko: "활동사진", en: "Activity photos" },
  { id: "events", ko: "행사자료", en: "Event materials" },
  { id: "other", ko: "기타 자료", en: "Other" }
] as const;
export type ResourceClub = "ecc" | "hanhwal";
export const categoriesFor = (club: ResourceClub) => club === "hanhwal" ? hanhwalResourceCategories : resourceCategories;
export type ResourceCategory = typeof resourceCategories[number]["id"] | typeof hanhwalResourceCategories[number]["id"];

export function isResourceCategory(value: unknown, club: ResourceClub = "ecc"): value is ResourceCategory {
  return categoriesFor(club).some((category) => category.id === value);
}

export function normalizeResourceCategory(value: unknown, club: ResourceClub = "ecc"): ResourceCategory {
  return isResourceCategory(value, club) ? value : "other";
}

export function resourceCategoryLabel(value: unknown, language: "ko" | "en", club: ResourceClub = "ecc") {
  return categoriesFor(club).find((category) => category.id === normalizeResourceCategory(value, club))![language];
}

export function filterResources(resources: EccResource[], query: string, category: ResourceCategory | "all", club: ResourceClub = "ecc") {
  const search = query.trim().toLocaleLowerCase();
  return resources.filter((resource) =>
    (category === "all" || normalizeResourceCategory(resource.category, club) === category) &&
    `${resource.title} ${resource.description} ${resource.fileName}`.toLocaleLowerCase().includes(search)
  );
}

export const resourceTypes: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  hwp: "application/x-hwp",
  hwpx: "application/vnd.hancom.hwpx",
  odt: "application/vnd.oasis.opendocument.text",
  odp: "application/vnd.oasis.opendocument.presentation",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  rtf: "application/rtf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  mp4: "video/mp4",
  mp3: "audio/mpeg"
};

export type EccResource = {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploaderName: string;
  createdAt: string;
  publishedAt: string;
  status?: "uploading" | "pending" | "published" | "deleted";
  visibility?: "public" | "members" | "staff";
  revision?: number;
};

export function resourceExtension(fileName: string) {
  return fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
}

export function resourceMime(fileName: string) {
  return resourceTypes[resourceExtension(fileName)] || "";
}

export function validateResourceFile(fileName: unknown, size: unknown, reportedMime: unknown) {
  if (typeof fileName !== "string" || !fileName.trim() || fileName.length > 180 || /[\\/\u0000-\u001f]/.test(fileName)) {
    throw new Error("Choose a file with a valid name.");
  }
  const mimeType = resourceMime(fileName);
  if (!mimeType) throw new Error("This file type is not supported.");
  if (!Number.isInteger(size) || Number(size) <= 0 || Number(size) > maxResourceBytes) {
    throw new Error("Choose a file up to 50 MB.");
  }
  if (reportedMime && reportedMime !== mimeType && !(resourceExtension(fileName) === "jpg" && reportedMime === "image/jpg")) {
    throw new Error("The file type does not match its extension.");
  }
  return { fileName: fileName.trim(), mimeType, sizeBytes: Number(size), extension: resourceExtension(fileName) };
}

export function canPreviewResource(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType === "text/plain" || mimeType === "text/csv" || mimeType === "video/mp4" || mimeType === "audio/mpeg";
}
