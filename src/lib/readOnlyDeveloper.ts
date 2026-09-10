// These accounts may inspect developer screens, but must never receive write access.
export const readOnlyDeveloperEmails = ["noritakeyuki@fuji.waseda.jp"];
export const readOnlyDeveloperHeader = "x-kline-read-only-developer";

export function isReadOnlyDeveloperEmail(email?: string | null) {
  return readOnlyDeveloperEmails.includes((email ?? "").trim().toLowerCase());
}

export function isReadOnlyMethod(method: string) {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
