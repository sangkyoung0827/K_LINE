import { club, StudioError, type StudioClub } from "./model";

// Resolve context, not permission. The service checks the resolved club separately.
export function resolveStudioClub(message: string, explicit?: unknown): StudioClub {
  // Standalone requests belong to the signed-in creator, even if they mention a club.
  if (explicit === undefined || explicit === "personal") return "personal";
  const matches: StudioClub[] = [];
  if (/\becc\b/i.test(message)) matches.push("ecc");
  if (/한활|\bhanh?wal\b/i.test(message)) matches.push("hanhwal");
  if (/소셜\s*임팩트\s*유니온|\bsocial\s*impact\s*union\b|\bsiu\b/i.test(message)) matches.push("social_impact_union");
  if (matches.length > 1) throw new StudioError("EVENT_ORGANIZER_AMBIGUOUS");
  if (explicit !== undefined) {
    const key = club(explicit);
    if (matches.length && matches[0] !== key) throw new StudioError("EVENT_SCOPE_MISMATCH");
    return key;
  }
  throw new StudioError("EVENT_ORGANIZER_REQUIRED");
}
