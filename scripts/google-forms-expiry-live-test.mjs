// Approved disposable form only; never reads/writes native membership records.
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const { web } = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (web.project_id !== "kline-forms-test") throw new Error("Unexpected Google test project");
const db = JSON.parse(readFileSync("private/supabase-server.local.json", "utf8"));
const { encryptionKey } = JSON.parse(readFileSync("private/google-forms-oauth.local.json", "utf8"));
Object.assign(process.env, {
  GOOGLE_FORMS_AUTOMATION_ENABLED: "true", GOOGLE_FORMS_ENVIRONMENT: "test",
  GOOGLE_FORMS_TEST_ORIGIN: "http://localhost:3300", GOOGLE_FORMS_TEST_SUPABASE_URL: db.url,
  GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY: db.key, GOOGLE_FORMS_TEST_TABLE_PREFIX: "kline_forms_test_",
  GOOGLE_TOKEN_ENCRYPTION_KEY: encryptionKey, GOOGLE_FORMS_CLIENT_ID: web.client_id,
  GOOGLE_FORMS_CLIENT_SECRET: web.client_secret,
});
delete process.env.VERCEL_ENV;
const integrationMode = process.argv[3] === "--integration";
if (integrationMode) Object.assign(process.env, { GOOGLE_FORMS_ECC_RESPONDER_GATE_ENABLED: "true", GOOGLE_FORMS_SERVER_REVOCATION_ENABLED: "true" });
const temp = mkdtempSync(join(process.cwd(), "node_modules", ".forms-expiry-"));
await build({ stdin: { contents: "export {decryptGoogleToken} from './src/lib/googleForms/crypto'; export {supabaseRequest} from './src/lib/googleForms/store';" + (integrationMode ? "export {grantEccFormResponder} from './src/lib/googleForms/eccResponderEntry'; export {revokeExpiredEccFormEntries} from './src/lib/googleForms/eccFormLeases';" : ""), resolveDir: process.cwd(), loader: "ts" }, outfile: join(temp, "test.cjs"), bundle: true, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "server-shims", setup(builder) {
  builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "shim" }));
  builder.onResolve({ filter: /^@\/lib\/admin$/ }, () => ({ path: "admin", namespace: "shim" }));
  builder.onResolve({ filter: /^@\/lib\/eccAccess$/ }, () => ({ path: "outage", namespace: "shim" }));
  builder.onResolve({ filter: /^@\/lib\/eccAccessRetry$/ }, () => ({ path: "retry", namespace: "shim" }));
  builder.onLoad({ filter: /.*/, namespace: "shim" }, args => ({ loader: "js", contents: args.path === "admin" ? 'export const normalizeEmail = value => (value || "").trim().toLowerCase();' : args.path === "outage" ? 'export async function getEccRoleRow(email) {if(email!=="samgkyoung1004@gmail.com") throw new Error("Unexpected test recipient"); throw new Error("CONTROLLED_TEST_OUTAGE");}' : args.path === "retry" ? 'export const isTemporaryEccLookupError = error => error.message === "CONTROLLED_TEST_OUTAGE";' : "" }));
} }] });
const { decryptGoogleToken, supabaseRequest, grantEccFormResponder, revokeExpiredEccFormEntries } = (await import(pathToFileURL(join(temp, "test.cjs")).href)).default;
const [connection] = await supabaseRequest("google_oauth_connections?id=eq.operations&select=account_email,encrypted_refresh_token&limit=1");
if (connection?.account_email !== "waterfallingsound0827@gmail.com") throw new Error("Unexpected connected owner");
async function token() {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: AbortSignal.timeout(20_000), body: new URLSearchParams({ client_id: web.client_id, client_secret: web.client_secret, refresh_token: decryptGoogleToken(connection.encrypted_refresh_token), grant_type: "refresh_token" }) });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Token refresh failed (${response.status})`);
  return data.access_token;
}
async function api(url, init = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(JSON.stringify({ httpStatus: response.status, message: data.error?.message, reasons: data.error?.errors?.map(error => error.reason) }));
  return data;
}
const serverMode = integrationMode || process.argv[3] === "--server-revocation";
const reportPath = integrationMode ? "docs/google-forms-server-revocation-integrated-20261006.json" : serverMode ? "docs/google-forms-server-revocation-live-20261006.json" : "docs/google-forms-native-expiry-live-20261006.json";
const report = { account: "samgkyoung1004@gmail.com", startedAt: new Date().toISOString(), formId: null, permissionId: null, expirationTime: null, nativeExpiryAccepted: false, postExpiryAccessVerified: false, cleanupVerified: false };
let base;
try {
  const form = await api("https://forms.googleapis.com/v1/forms?unpublished=true", { method: "POST", body: JSON.stringify({ info: { title: "[KLINE PRIVATE EXPIRY TEST] ECC temporary entry 2026-10-06" } }) });
  if (!form.formId) throw new Error("Missing new test form ID");
  report.formId = form.formId;
  base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(form.formId)}`;
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  if (integrationMode) {
    const initial = await api(`${base}/permissions?includePermissionsForView=published&fields=permissions(id,type,role,view)`);
    // Only this newly created disposable form's default public responder grant.
    for (const item of initial.permissions || []) {
      if (item.type === "anyone" && item.role === "reader" && item.view === "published") await api(`${base}/permissions/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      else if (item.type !== "user") throw new Error("Unexpected non-user test permission");
    }
    const restricted = await api(`${base}/permissions?includePermissionsForView=published&fields=permissions(type)`);
    if ((restricted.permissions || []).some(item => item.type !== "user")) throw new Error("Test form is not restricted");
    await api(`https://forms.googleapis.com/v1/forms/${form.formId}:setPublishSettings`, { method: "POST", body: JSON.stringify({ publishSettings: { publishState: { isPublished: true, isAcceptingResponses: true } } }) });
    const remote = await api(`https://forms.googleapis.com/v1/forms/${form.formId}`);
    report.responderUrl = remote.responderUri;
    report.testScope = "Real prefixed DB leases and Google permission worker; controlled membership outage, 30-second accelerated expiry, authenticated browser identity not tested";
    await revokeExpiredEccFormEntries();
    const expires = Date.now() + 30_000;
    const grant = await grantEccFormResponder({ google_form_id: form.formId, club_key: "ecc", status: "open", application_deadline: null }, report.account, expires);
    const [lease] = await supabaseRequest(`ecc_form_entry_leases?google_form_id=eq.${form.formId}&email=eq.${encodeURIComponent(report.account)}&select=*`);
    report.permissionId = lease?.permission_id;
    report.expiresAt = grant.expires;
    report.durableLeaseVerified = lease?.state === "active" && Date.parse(lease.expires_at) === expires;
    if (!report.durableLeaseVerified) throw new Error("Durable lease verification failed");
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    while (Date.now() < expires) {
      const before = await revokeExpiredEccFormEntries();
      if (before.revoked) throw new Error("Test permission was revoked before expiry");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    report.workerResult = await revokeExpiredEccFormEntries();
    const [after] = await supabaseRequest(`ecc_form_entry_leases?google_form_id=eq.${form.formId}&email=eq.${encodeURIComponent(report.account)}&select=*`);
    const remaining = await api(`${base}/permissions?includePermissionsForView=published&fields=permissions(id,emailAddress)`);
    report.automaticRevocationVerified = after?.state === "revoked" && !(remaining.permissions || []).some(item => item.id === report.permissionId);
    if (!report.automaticRevocationVerified) throw new Error("Automatic revocation verification failed");
    report.finishedAt = new Date().toISOString();
  } else {
  const expiry = new Date(Date.now() + 15 * 60_000).toISOString();
  const permission = await api(`${base}/permissions?sendNotificationEmail=false&fields=id,expirationTime`, { method: "POST", body: JSON.stringify({ type: "user", role: "reader", view: "published", emailAddress: report.account, ...(!serverMode ? {expirationTime: expiry} : {}) }) });
  report.permissionId = permission.id;
  report.expirationTime = permission.expirationTime;
  report.nativeExpiryAccepted = permission.expirationTime === expiry;
  if (serverMode) {
    const { permissions = [] } = await api(`${base}/permissions?includePermissionsForView=published&fields=permissions(id,role,view,emailAddress)`);
    report.serverGrantVerified = permissions.some(item => item.id === permission.id && item.role === "reader" && item.view === "published" && item.emailAddress === report.account);
    report.testScope = "Real Google grant/delete primitives only; no published form, authenticated respondent or remote DB worker verification";
    if (!report.serverGrantVerified) throw new Error("Responder grant not confirmed");
  } else if (!report.nativeExpiryAccepted) throw new Error("Google did not preserve requested expirationTime");
  }
} catch (error) {
  report.error = error.message;
} finally {
  if (base) {
    if (integrationMode) await api(`https://forms.googleapis.com/v1/forms/${report.formId}:setPublishSettings`, { method: "POST", body: JSON.stringify({ publishSettings: { publishState: { isPublished: false, isAcceptingResponses: false } } }) });
    const permissions = await api(`${base}/permissions?includePermissionsForView=published&fields=permissions(id,type,role,view,emailAddress,expirationTime)`);
    // Remove only this new disposable form's test-account respondent grants.
    for (const permission of permissions.permissions || []) {
      if (permission.emailAddress?.toLowerCase() === report.account && permission.role === "reader") await api(`${base}/permissions/${encodeURIComponent(permission.id)}`, { method: "DELETE" });
    }
    const remaining = await api(`${base}/permissions?includePermissionsForView=published&fields=permissions(id,emailAddress)`);
    report.cleanupVerified = !(remaining.permissions || []).some(permission => permission.emailAddress?.toLowerCase() === report.account);
    // Recoverable trash of only the new disposable form; no existing form changes.
    await api(`${base}?fields=id,trashed`, { method: "PATCH", body: JSON.stringify({ trashed: true }) });
    report.testFormTrashed = true;
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
