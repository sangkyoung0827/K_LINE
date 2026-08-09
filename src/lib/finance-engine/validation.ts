import "server-only";

export function normalizeFinanceSymbol(value: unknown) {
  return String(value ?? "").trim().slice(0, 12).toUpperCase();
}

export function isValidFinanceSymbol(symbol: string) {
  return /^[0-9A-Za-z가-힣 .-]{1,20}$/.test(symbol.trim());
}
