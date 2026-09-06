import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { WoohyukmonConfirmationPayload } from "@/lib/woohyukmon/operations/types";

function secret() {
  const value = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

  if (!value) {
    throw new Error("Woohyukmon confirmation signing is not configured.");
  }

  return value;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(encoded: string) {
  return createHmac("sha256", secret()).update(encoded).digest("base64url");
}

export function createWoohyukmonConfirmationToken(
  payload: WoohyukmonConfirmationPayload
) {
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyWoohyukmonConfirmationToken(token: string) {
  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    throw new Error("Invalid confirmation token.");
  }

  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid confirmation token.");
  }

  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8")
  ) as WoohyukmonConfirmationPayload;

  if (
    payload.version !== 1 ||
    !payload.actorEmail ||
    !payload.tool ||
    !Array.isArray(payload.targetIds) ||
    payload.expiresAt <= Date.now()
  ) {
    throw new Error("Confirmation has expired or is invalid.");
  }

  return payload;
}
