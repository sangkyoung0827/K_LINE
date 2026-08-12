import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createCollectorToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashCollectorToken(token) };
}

export function hashCollectorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function collectorTokenMatches(token: string, expectedHash: string) {
  const actual = Buffer.from(hashCollectorToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}
