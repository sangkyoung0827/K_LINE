import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
export function loadGksModule(file, mocks = {}, globals = {}) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { console, URL, Blob, Response, Intl, TextEncoder, ...globals })(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports
  );
  return module.exports;
}

export function createGksAccessHarness() {
  const state = { email: "", dbCalls: 0 };
  const readOnly = loadGksModule("src/lib/readOnlyDeveloper.ts");
  const admin = loadGksModule("src/lib/admin.ts", {
    "@/lib/readOnlyDeveloper": readOnly,
    "@/lib/supabaseServer": { supabaseRequest: async () => { state.dbCalls++; throw new Error("No operational database access in GKS tests"); }, SupabaseConfigError: class extends Error {}, SupabaseRequestError: class extends Error {} }
  }, { process: { env: { DEVELOPER_EMAILS: "waterfallingsound0827@gmail.com,approved@example.test", SUPER_ADMIN_EMAILS: "superadmin@example.test" } } });
  const access = loadGksModule("src/lib/gksHub/access.ts", {
    "server-only": {}, "@/auth": { auth: async () => state.email ? { user: { email: state.email } } : null }, "@/lib/admin": admin
  });
  const route = loadGksModule("src/app/api/gks-hub/access/route.ts", {
    "@/lib/gksHub/access": access, "next/server": { NextResponse: Response }
  });
  return { state, access, route };
}
