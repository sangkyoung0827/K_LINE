import "server-only";
import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { isDeveloperEmail, normalizeEmail } from "@/lib/admin";

export async function getGksHubAccess() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  const allowed = Boolean(session?.user && email && isDeveloperEmail(email));
  return {
    authenticated: Boolean(session?.user && email),
    allowed,
    email: allowed ? email : "",
    draftKey: allowed ? `kline:gks-hub:v1:${createHash("sha256").update(email).digest("hex")}` : ""
  };
}
