import "server-only";
import { auth } from "@/auth";
import { getAdminAccess, normalizeEmail } from "@/lib/admin";
import { getEccAccessForEmail } from "@/lib/eccAccess";
import { getHanhwalAccessForEmail } from "@/lib/hanhwalAccess";
import { getCurrentSiuAccess } from "@/lib/siu/access";
import { getJejuAccessForEmail } from "@/lib/jeju/access";
import { getResearchEditorAccess } from "@/lib/research/server";

export type AssistantScope = "ecc" | "hanhwal" | "social_impact_union" | "jeju" | "research" | "event_archive";
export type ClubAssistantAccess = { email: string; readOnly: boolean; scopes: AssistantScope[]; roles: Partial<Record<AssistantScope, string>> };

export async function getClubAssistantAccess(): Promise<ClubAssistantAccess> {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email) return { email: "", readOnly: true, scopes: [], roles: {} };
  const global = await getAdminAccess(email);
  const result: ClubAssistantAccess = { email, readOnly: Boolean(global.isReadOnly), scopes: [], roles: {} };
  const lookups = [
    ["ecc", () => getEccAccessForEmail(email)],
    ["hanhwal", () => getHanhwalAccessForEmail(email)],
    ["social_impact_union", () => getCurrentSiuAccess()],
    ["jeju", () => getJejuAccessForEmail(email)]
  ] as const;
  // A failed club lookup cannot grant access or hide another club's valid grant.
  const grants = await Promise.allSettled(lookups.map(([, lookup]) => lookup()));
  grants.forEach((grant, index) => {
    if (grant.status === "fulfilled" && grant.value.isAdmin) { const scope = lookups[index][0]; result.scopes.push(scope); result.roles[scope] = grant.value.role; }
  });
  try { if ((await getResearchEditorAccess()).canEdit) { result.scopes.push("research"); result.roles.research = "editor"; } } catch { /* fail closed */ }
  if (global.isDeveloper) { result.scopes.push("event_archive"); result.roles.event_archive = "developer"; }
  return result;
}

export function scopeForPath(path: string): AssistantScope | "" {
  if (/hanhwal|han-hwal/.test(path)) return "hanhwal";
  if (/social-impact-union|\/siu/.test(path)) return "social_impact_union";
  if (/\/jeju/.test(path)) return "jeju";
  if (/open-k-culture-research/.test(path)) return "research";
  if (/event-studio/.test(path)) return "event_archive";
  if (/ecc|google-forms/.test(path)) return "ecc";
  return "";
}
