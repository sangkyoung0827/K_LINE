export function normalizePreferenceUserKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
