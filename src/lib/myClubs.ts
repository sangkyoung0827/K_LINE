export const myClubOptions = [
  { id: "ecc", name: { ko: "ECC", en: "ECC" }, href: "/our-activities/ecc" },
  { id: "hanhwal", name: { ko: "한활", en: "Hanhwal" }, href: "/our-activities/hanhwal" }
] as const;

export type MyClubId = typeof myClubOptions[number]["id"];
export type MyClubStatus = "member" | "pending" | "none" | "unavailable" | "unauthenticated";
export type MyClubResult = { id: MyClubId; status: MyClubStatus };

type MembershipResponse = {
  access?: { email?: unknown; isLoggedIn?: boolean; isOfficialMember?: boolean; role?: string; lookupFailed?: boolean };
  registration?: { googleEmail?: unknown; officialMember?: boolean; status?: string } | null;
};

const emailKey = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";

export function resolveMyClubStatus(data: MembershipResponse | null, ownerEmail: string): MyClubStatus {
  if (!data?.access || typeof data.access.isLoggedIn !== "boolean") return "unavailable";
  if (!data.access.isLoggedIn) return "unauthenticated";
  const owner = emailKey(ownerEmail);
  if (!owner || emailKey(data.access.email) !== owner) return "unavailable";
  const registration = data.registration;
  if (registration) {
    if (emailKey(registration.googleEmail) !== owner) return "unavailable";
    if (registration.officialMember === true || registration.status === "approved") return "member";
    if (registration.status === "submitted" || registration.status === "payment_pending") return "pending";
    if (registration.status === "rejected") return "none";
    return "unavailable";
  }
  if (registration !== null || data.access.lookupFailed) return "unavailable";
  // Legacy memberships may have a club role without a newer registration form.
  // Global developer/admin visibility by itself does not mean the user joined.
  return data.access.role === "official_member" && data.access.isOfficialMember === true
    ? "member"
    : "none";
}

export async function loadMyClubs(
  ownerEmail: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch
): Promise<MyClubResult[]> {
  return Promise.all(myClubOptions.map(async ({ id }): Promise<MyClubResult> => {
    try {
      const response = await fetcher(`/api/${id}/member-registration`, {
        method: "GET", cache: "no-store", credentials: "same-origin", signal
      });
      if (response.status === 401) return { id, status: "unauthenticated" };
      if (!response.ok) return { id, status: "unavailable" };
      return { id, status: resolveMyClubStatus(await response.json(), ownerEmail) };
    } catch {
      return { id, status: "unavailable" };
    }
  }));
}
