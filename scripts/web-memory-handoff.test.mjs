import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import React from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks, globals = {}) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, globals)((name) => {
    if (name in mocks) return mocks[name];
    return require(name);
  }, module, module.exports);
  return module.exports;
}

test("every web entry point uses Woohyukmon instead of Memory Book", () => {
  for (const file of ["Navbar", "MobileBottomNav", "MobileNavigationMenu", "HomeTrackSections"]) {
    const source = readFileSync(`src/components/${file}.tsx`, "utf8");
    assert.doesNotMatch(source, /["']\/jeju(?:\/profile)?["']/);
    assert.match(source, /WoohyukmonLauncher/);
    assert.match(source, /WoohyukmonGlassesIcon/);
  }
});

test("old memory addresses lead to the app notice, never delete records or advertise an unreleased store link", () => {
  assert.match(readFileSync("src/app/jeju/page.tsx", "utf8"), /return <MemoryBookAppNotice/);
  for (const route of ["profile", "memories", "map", "ai", "discover", "program", "place/[id]"]) {
    assert.match(readFileSync(`src/app/jeju/${route}/page.tsx`, "utf8"), /redirect\("\/jeju"\)/);
  }
  const notice = readFileSync("src/components/MemoryBookAppNotice.tsx", "utf8");
  assert.match(notice, /기존 기록과 사진은 그대로 보존/);
  assert.doesNotMatch(notice, /apps\.apple\.com|play\.google\.com|fetch\(/);
  for (const route of ["profile", "memories", "reviews", "visits", "uploads"]) {
    assert.ok(readdirSync(`src/app/api/jeju/${route}`).includes("route.ts"));
  }
});

test("launcher lets a menu close first and emits an opening request, not a permission claim", () => {
  const events = [], frames = [];
  const { WoohyukmonLauncher } = load("src/components/WoohyukmonLauncher.tsx", {}, {
    requestAnimationFrame: fn => frames.push(fn), Event,
    window: { dispatchEvent: event => events.push(event.type) }
  });
  let closed = false;
  const trigger = WoohyukmonLauncher({ onClick: () => { closed = true; }, children: "Woohyukmon" });
  trigger.props.onClick({ defaultPrevented: false, currentTarget: { focus() {} } });
  assert.ok(closed);
  assert.deepEqual(events, []);
  frames[0]();
  assert.deepEqual(events, ["kline:open-woohyukmon"]);
});

test("guest, member, admin, read-only developer, failed and mismatched access remain separated", async () => {
  for (const scenario of [
    { status: "unauthenticated", email: "", access: {}, managed: false },
    { email: "member@test", access: { email: "member@test", scopes: [], roles: {} }, managed: false },
    { email: "admin@test", access: { email: "admin@test", scopes: ["ecc"], roles: { ecc: "admin" } }, managed: true },
    { email: "readonly@test", access: { email: "readonly@test", readOnly: true, scopes: ["ecc"] }, managed: false },
    { email: "member@test", access: { email: "other@test", scopes: ["ecc"] }, managed: false },
    { email: "member@test", access: null, managed: false }
  ]) {
    const states = [], effects = [], deps = [], cleanups = [], events = new EventTarget();
    let stateIndex = 0, effectIndex = 0, result;
    const fetches = [];
    const fakeReact = { ...React,
      useState(initial) {
        const i = stateIndex++;
        if (!(i in states)) states[i] = initial;
        return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; }];
      },
      useEffect(fn, next) {
        const i = effectIndex++;
        if (!deps[i] || next.some((value, index) => !Object.is(value, deps[i][index]))) {
          deps[i] = next;
          effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); });
        }
      }
    };
    const { GlobalWoohyukmonGate } = load("src/components/GlobalWoohyukmonGate.tsx", {
      react: fakeReact,
      "next/navigation": { usePathname: () => "/" },
      "next-auth/react": { useSession: () => ({ status: scenario.status || "authenticated", data: { user: { email: scenario.email } } }) },
      "@/components/WoohyukmonLauncher": { openWoohyukmonEvent: "kline:open-woohyukmon" },
      "@/components/GlobalWoohyukmon": { GlobalWoohyukmon: () => null },
      "@/lib/woohyukmon/activity-guide-access": { activityGuideAccess: (_, access) => ({ visible: Boolean(access.isAdmin), activityGuide: false, readOnly: !access.isAdmin }) }
    }, { window: events, AbortController, fetch: async (path, init) => {
      fetches.push({ path, init });
      if (scenario.access === null) throw new Error("Unavailable");
      return { ok: true, json: async () => scenario.access };
    } });
    const render = async () => {
      stateIndex = 0; effectIndex = 0;
      result = GlobalWoohyukmonGate();
      while (effects.length) effects.shift()();
      await new Promise(resolve => setImmediate(resolve));
    };
    await render(); await render();
    events.dispatchEvent(new Event("kline:open-woohyukmon"));
    await render(); await render(); await render();
    assert.ok(result, `Launcher must work for ${scenario.email || "guest"}`);
    assert.equal(result.props.readOnly, !scenario.managed);
    assert.equal(result.props.actorEmail, scenario.email);
    assert.deepEqual(Array.from(result.props.scopes || []), scenario.managed ? ["ecc"] : []);
    assert.equal(result.props.launchRequest, 1);
    assert.ok(fetches.every(call => call.path === "/api/woohyukmon/club-assistant" && !call.init.method));
    if (!scenario.email) assert.equal(fetches.length, 0);
    cleanups.forEach(fn => fn?.());
  }
});
