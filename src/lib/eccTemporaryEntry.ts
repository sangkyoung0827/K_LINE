import { createHmac, timingSafeEqual } from "node:crypto";

export const eccEntryCookie = "ecc-official-outage-entry";
export const eccEntryLifetime = 15 * 60;

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(`ecc-official-entry:${payload}`).digest("base64url");
}

export function issueEccEntry(email: string, secret: string, now = Date.now()) {
  if (!secret) throw new Error("ECC temporary entry signing is unavailable");
  const payload = Buffer.from(JSON.stringify({ email, expires: now + eccEntryLifetime * 1000 })).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function validEccEntry(token: string | undefined, email: string, secret: string, now = Date.now()) {
  if (!token || !email || !secret) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signed] = parts;
    const expected = Buffer.from(signature(payload, secret));
    const actual = Buffer.from(signed);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return value.email === email && Number.isFinite(value.expires) &&
      value.expires > now && value.expires <= now + eccEntryLifetime * 1000;
  } catch {
    return false;
  }
}
