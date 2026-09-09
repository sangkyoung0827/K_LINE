import type { ClubDocument, ClubKey, ClubSection } from "@/types/club-page";
import { THEME_PRESETS } from "./config";

export const MAX_DOCUMENT_BYTES = 300_000;
export class ClubPageError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const fail = () => {
  throw new ClubPageError("블록 형식, 길이 또는 URL을 확인해 주세요.");
};
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  const result = value as Record<string, unknown>;
  if (
    Object.keys(result).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(result, key))
  )
    return fail();
  return result;
}
function text(value: unknown, limit: number): string {
  if (
    typeof value !== "string" ||
    value.length > limit ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    return fail();
  return value;
}
export function safeLink(value: unknown): string {
  const url = text(value, 2048);
  if (!url) return "";
  if (url !== url.trim() || /[\s\\]/.test(url) || /%0[ad]/i.test(url))
    return fail();
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      return fail();
    // Team-chat invites must never be published by this public presentation layer.
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (
      hostname === "invite.kakao.com" ||
      hostname.endsWith(".invite.kakao.com")
    )
      return fail();
    return url;
  } catch {
    return fail();
  }
}
function image(value: unknown, club: ClubKey, mediaOrigin?: string): string {
  const url = text(value, 2048);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const prefix = `/storage/v1/object/public/club-page-media/${club}/`;
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      (mediaOrigin && parsed.origin !== new URL(mediaOrigin).origin) ||
      !parsed.pathname.startsWith(prefix) ||
      !/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(
        parsed.pathname.slice(prefix.length),
      )
    )
      return fail();
    return url;
  } catch {
    return fail();
  }
}
type Rule = number | "link" | "image";
const shapes: Record<string, Record<string, Rule>> = {
  hero: {
    title: 160,
    subtitle: 1000,
    imageUrl: "image",
    buttonLabel: 100,
    buttonUrl: "link",
  },
  about: { heading: 160, body: 5000 },
  gallery: { heading: 160 },
  schedule: { heading: 160 },
  members: { heading: 160 },
  recruit: {
    heading: 160,
    description: 5000,
    buttonLabel: 100,
    buttonUrl: "link",
  },
  links: { heading: 160 },
};
const arrays: Record<
  string,
  { key: string; limit: number; shape: Record<string, Rule> }
> = {
  gallery: {
    key: "images",
    limit: 24,
    shape: { imageUrl: "image", caption: 300 },
  },
  schedule: {
    key: "items",
    limit: 30,
    shape: { date: 100, title: 160, description: 1000 },
  },
  members: {
    key: "members",
    limit: 30,
    shape: { name: 160, role: 160, imageUrl: "image", description: 1000 },
  },
  links: { key: "links", limit: 30, shape: { label: 160, url: "link" } },
};
export function validateDocument(
  value: unknown,
  club: ClubKey,
  mediaOrigin?: string,
): ClubDocument {
  const doc = object(value, ["themeId", "sections"]);
  if (
    !THEME_PRESETS.some((theme) => theme.id === doc.themeId) ||
    !Array.isArray(doc.sections) ||
    doc.sections.length > 30
  )
    return fail();
  const ids = new Set<string>();
  const checkFields = (
    obj: Record<string, unknown>,
    shape: Record<string, Rule>,
  ) => {
    for (const [key, rule] of Object.entries(shape)) {
      if (rule === "link") safeLink(obj[key]);
      else if (rule === "image") image(obj[key], club, mediaOrigin);
      else text(obj[key], rule);
    }
  };
  for (const raw of doc.sections) {
    const section = object(raw, ["id", "type", "data"]);
    const id = text(section.id, 80);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) return fail();
    ids.add(id);
    const type = text(section.type, 20);
    if (!Object.hasOwn(shapes, type)) return fail();
    const list = arrays[type];
    const data = object(section.data, [
      ...Object.keys(shapes[type]),
      ...(list ? [list.key] : []),
    ]);
    checkFields(data, shapes[type]);
    if (list) {
      const rows = data[list.key];
      if (!Array.isArray(rows) || rows.length > list.limit) return fail();
      for (const row of rows)
        checkFields(object(row, Object.keys(list.shape)), list.shape);
    }
  }
  if (new TextEncoder().encode(JSON.stringify(doc)).length > MAX_DOCUMENT_BYTES)
    return fail();
  return {
    themeId: doc.themeId as ClubDocument["themeId"],
    sections: doc.sections as ClubSection[],
  };
}
export function validateWrite(value: unknown, club: ClubKey, origin?: string) {
  const body = object(value, ["document", "revision"]);
  if (!Number.isSafeInteger(body.revision) || (body.revision as number) < 0)
    return fail();
  return {
    document: validateDocument(body.document, club, origin),
    revision: body.revision as number,
  };
}
