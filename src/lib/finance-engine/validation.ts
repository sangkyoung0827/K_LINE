import "server-only";

export function normalizeFinanceSymbol(value: unknown) {
  return String(value ?? "").trim().slice(0, 12).toUpperCase();
}

export function isValidFinanceSymbol(symbol: string) {
  return /^[A-Z0-9.-]{1,12}$/.test(symbol);
}
