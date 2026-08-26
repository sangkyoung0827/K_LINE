import type { JejuPlace, JejuPlaceCategory } from "@/lib/jeju/types";

export const jejuCategoryLabels: Record<JejuPlaceCategory, string> = {
  restaurant: "Restaurant",
  cafe: "Cafe",
  attraction: "Attraction",
  hidden_spot: "Hidden spot",
  shopping: "Shopping",
  culture: "Culture",
  nature: "Nature",
  other: "Other"
};

export function placeTitle(place: Pick<JejuPlace, "name" | "nameEn">) {
  return place.nameEn || place.name;
}

export function splitKeywords(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 16);
}

export async function readJejuResponse<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {})
    }
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Jeju Explorer could not complete that request.");
  }

  return payload;
}

export function formatJejuDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

export function formatJejuDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
