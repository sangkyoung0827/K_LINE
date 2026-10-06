// Narrow cleanup command: only the approved disposable Gathering test form.
import { readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const { web } = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (web.project_id !== "kline-forms-test") throw new Error("Wrong Google project");
const db = JSON.parse(readFileSync("private/supabase-server.local.json", "utf8"));
const { encryptionKey } = JSON.parse(readFileSync("private/google-forms-oauth.local.json", "utf8"));
Object.assign(process.env, {
  GOOGLE_FORMS_AUTOMATION_ENABLED: "true", GOOGLE_FORMS_ENVIRONMENT: "test",
  GOOGLE_FORMS_TEST_ORIGIN: "http://localhost:3300", GOOGLE_FORMS_TEST_SUPABASE_URL: db.url,
  GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY: db.key, GOOGLE_FORMS_TEST_TABLE_PREFIX: "kline_forms_test_",
  GOOGLE_TOKEN_ENCRYPTION_KEY: encryptionKey, GOOGLE_FORMS_CLIENT_ID: web.client_id,
  GOOGLE_FORMS_CLIENT_SECRET: web.client_secret
});
delete process.env.VERCEL_ENV;
const temp = mkdtempSync(join(process.cwd(), "node_modules", ".forms-restore-"));
await build({ stdin: { contents: "export {setGoogleFormStatus} from './src/lib/googleForms/googleApi'; export {supabaseRequest} from './src/lib/googleForms/store';", resolveDir: process.cwd(), loader: "ts" }, outfile: join(temp, "restore.cjs"), bundle: true, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "server-shims", setup(builder) {
  builder.onResolve({filter:/^server-only$/},()=>({path:"empty",namespace:"shim"}));
  builder.onResolve({filter:/^@\/lib\/admin$/},()=>({path:"admin",namespace:"shim"}));
  builder.onLoad({filter:/.*/,namespace:"shim"},args=>({loader:"js",contents:args.path==="admin"?'export const normalizeEmail = value => (value || "").trim().toLowerCase();':""}));
}}] });
const {setGoogleFormStatus,supabaseRequest}=(await import(pathToFileURL(join(temp,"restore.cjs")).href)).default;
const [form]=await supabaseRequest("google_forms?select=*&id=eq.5901aac7-493b-4b08-995d-83089bd2e86a&limit=1");
if (form?.google_form_id!=="1hab2m2usa68tA-hkhPGHJNi-c9IqAPKrBwDsWUriIFI" || form.title!=="[KLINE PRIVATE TEST] ECC Gathering 2026-10-06") throw new Error("Unexpected cleanup target");
const restored=await setGoogleFormStatus(form,"draft");
console.log(JSON.stringify({id:restored.id,status:restored.status,publicationVerified:true}));
