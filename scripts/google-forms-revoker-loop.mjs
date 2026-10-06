// Run from a persistent, supervised worker, not a browser tab or serverless timer.
const endpoint = process.env.GOOGLE_FORMS_REVOKER_URL;
const secret = process.env.GOOGLE_FORMS_REVOKER_SECRET;
if (!endpoint || !secret || secret.length < 32) throw new Error("Revoker URL/secret required");
const url = new URL(endpoint);
if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) throw new Error("HTTPS required");
if (url.pathname !== "/api/google-forms/ecc-entry/revoke") throw new Error("Unexpected revoker endpoint");
let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });
while (running) {
  try {
    const response = await fetch(url, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(300_000) });
    const result = await response.json();
    console.log(JSON.stringify({ at: new Date().toISOString(), status: response.status, revoked: result.revoked, promoted: result.promoted, retry: result.retry, attention: result.attention }));
  } catch { console.error("REVOCATION_RUN_FAILED"); }
  if (running) await new Promise(resolve => setTimeout(resolve, 30_000));
}
