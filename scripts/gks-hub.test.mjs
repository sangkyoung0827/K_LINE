import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import { createGksAccessHarness, loadGksModule } from "./lib/gks-hub-harness.mjs";

const reference = loadGksModule("src/lib/gksHub/reference.ts");
const model = loadGksModule("src/lib/gksHub/model.ts", { "./reference": reference });
const word = loadGksModule("src/lib/gksHub/word.ts", { "./model": model, "./reference": reference });

test("only owner and explicitly approved developer identities pass the real page/API policy", async () => {
  const h = createGksAccessHarness();
  const page = loadGksModule("src/app/gks-hub/page.tsx", {
    "@/lib/gksHub/access": h.access,
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); } },
    "@/components/gks-hub/GksHub": { GksHub: () => React.createElement("span", null, "private-test") }
  });
  const home = loadGksModule("src/app/page.tsx", {
    "@/lib/gksHub/access": h.access, "@/auth": { auth: async () => h.state.email ? { user: { email: h.state.email } } : null },
    "@/components/HeroSection": { HeroSection: () => null },
    "@/components/HomeTrackSections": { HomeTrackSections: ({ developerServices }) => React.createElement("section", null, developerServices) },
    "@/components/gks-hub/GksHubCard": { GksHubCard: () => React.createElement("a", { href: "/gks-hub" }, "GKS Hub") },
    "@/lib/coDevelopment/model": { canUseCoDevelopment: Boolean }, "@/lib/seo": { siteConfig: {}, seoKeywords: [] }
  });
  for (const email of ["", "member@example.test", "club-admin@example.test", "superadmin@example.test", "noritakeyuki@example.test"]) {
    h.state.email = email;
    assert.equal((await h.access.getGksHubAccess()).allowed, false);
    const response = await h.route.GET(new Request("https://isolated.test/api/gks-hub/access?role=developer&email=waterfallingsound0827@gmail.com", { headers: { "x-role": "developer" } }));
    assert.equal(response.status, email ? 403 : 401);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(await response.json(), { allowed: false });
    await assert.rejects(page.default(), /NOT_FOUND/);
    assert.doesNotMatch(JSON.stringify(await page.generateMetadata()), /GKS Hub/);
    assert.doesNotMatch(renderToStaticMarkup(await home.default()), /GKS Hub|gks-hub/);
  }
  const keys = new Set();
  for (const email of ["waterfallingsound0827@gmail.com", " Approved@Example.Test ", "noritakeyuki@fuji.waseda.jp"]) {
    h.state.email = email;
    const access = await h.access.getGksHubAccess();
    assert.equal(access.allowed, true);
    assert.match(access.draftKey, /^kline:gks-hub:v1:[a-f0-9]{64}$/);
    keys.add(access.draftKey);
    const response = await h.route.GET();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("X-Robots-Tag"), /noindex/);
    assert.equal((await response.json()).draftKey, access.draftKey);
    assert.match(renderToStaticMarkup(await page.default()), /private-test/);
    assert.match(renderToStaticMarkup(await home.default()), /GKS Hub/);
  }
  assert.equal(keys.size, 3, "each developer's browser drafts have a different namespace");
  assert.equal(h.state.dbCalls, 0, "no real user/member/research/organization data is read or changed");
});

test("250 nationalities support Korean, English and code search, rejecting forged suffixes", () => {
  assert.equal(model.gksCountries().length, 250);
  assert.equal(new Set(reference.countryCodes).size, 250);
  for (const [query, result] of [["독일", "DE"], ["netherlands", "NL"], ["md", "MD"], ["인도네시아 / Indonesia (ID)", "ID"]]) assert.equal(model.findGksCountry(query), result);
  for (const invalid of ["Atlantis", "Forged name (DE)", "ZZ"]) assert.equal(model.findGksCountry(invalid), "");
});

test("checklist degree/track/university filters preserve original scope and count only required ready documents", () => {
  const draft = model.emptyGksDraft();
  let ids = model.gksDocuments(draft).map(d => d.id);
  assert.ok(ids.includes("f2") && ids.includes("f3"));
  assert.ok(!ids.includes("f4") && !ids.includes("master-degree") && !ids.includes("jbnu-submission"));
  draft.school = "jbnu";
  assert.ok(model.gksDocuments(draft).some(d => d.id === "jbnu-submission"));
  draft.track = "Embassy";
  assert.ok(!model.gksDocuments(draft).some(d => d.id === "jbnu-submission"));
  draft.degree = "R";
  ids = model.gksDocuments(draft).map(d => d.id);
  assert.ok(ids.includes("f4") && ids.includes("f6") && !ids.includes("f3"));
  draft.documents.f2 = { stage: "ready", note: "original note" };
  draft.documents.passport = { stage: "ready", note: "optional" };
  assert.equal(model.gksProgress(draft).ready, 1);
  draft.degree = "D";
  assert.ok(model.gksDocuments(draft).some(d => d.id === "master-degree"));
  assert.equal(draft.documents.f2.note, "original note");
});

test("versioned draft restore is bounded and strips unknown data without importing prototype demo storage", () => {
  const draft = model.emptyGksDraft();
  draft.country = "NL"; draft.customUniversity = "Custom university"; draft.school = "custom"; draft.department = "Research";
  draft.writer.f2 = { fullName: "Test User", motivation: "한국 & <study>\n😀" };
  draft.documents.f2 = { stage: "working", note: "Keep this" };
  const restored = model.restoreGksDraft(JSON.parse(JSON.stringify(draft)));
  assert.equal(restored.customUniversity, draft.customUniversity);
  assert.equal(restored.writer.f2.motivation, draft.writer.f2.motivation);
  assert.equal(restored.documents.f2.note, "Keep this");
  const bad = model.restoreGksDraft({ version: 1, country: "ZZ", degree: "bad", documents: { f2: { stage: "bad", note: "a".repeat(8000) }, secret: { note: "never" } }, writer: { f2: { fullName: "a".repeat(500), motivation: "\0<test>&" } } });
  assert.equal(bad.country, ""); assert.equal(bad.degree, "M"); assert.equal(bad.documents.f2.stage, "todo");
  assert.equal(bad.documents.f2.note.length, 5000); assert.equal(bad.writer.f2.fullName.length, 120);
  assert.equal(bad.writer.f2.motivation, "<test>&"); assert.equal(bad.documents.secret, undefined);
  assert.equal(model.restoreGksDraft({ version: 999 }).country, "");
});

test("both Word downloads are real DOCX packages preserving text, Unicode and paragraph breaks", async () => {
  for (const form of ["f2", "f3"]) {
    const field = reference.writerFields[form][0];
    const blob = await word.createGksWord(form, { fullName: "QA & Test", [field.id]: "첫째 <research> & study\n둘째 😀" }, "en");
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString(), "PK");
    const zip = await JSZip.loadAsync(bytes);
    assert.ok(zip.file("[Content_Types].xml"));
    const xml = await zip.file("word/document.xml").async("string");
    assert.match(xml, /QA &amp; Test/); assert.match(xml, /첫째 &lt;research&gt; &amp; study/); assert.match(xml, /둘째 😀/);
    assert.match(xml, new RegExp(model.gksWriterTitle(form).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(xml, /Preparation draft only/);
    assert.ok(xml.indexOf("첫째") < xml.indexOf("둘째"));
  }
  await assert.rejects(word.createGksWord("f2", { motivation: "content" }, "ko"), /INCOMPLETE_GKS_DRAFT/);
  await assert.rejects(word.createGksWord("f3", { fullName: "QA" }, "ko"), /INCOMPLETE_GKS_DRAFT/);
});

test("GKS stays out of public assets/sitemap; the shared home preserves Developer Studio last", () => {
  const client = readFileSync("src/components/gks-hub/GksHub.tsx", "utf8");
  assert.match(client, /sessionStorage\.getItem\(draftKey\)/);
  assert.match(client, /sessionStorage\.setItem\(draftKey/);
  assert.doesNotMatch(client, /localStorage|dangerouslySetInnerHTML|supabase|OPENAI_API_KEY|gks-hub-ui-demo/);
  assert.match(client, /fetch\("\/api\/gks-hub\/access", \{ cache: "no-store" \}\)/);
  assert.match(readFileSync("src/app/robots.ts", "utf8"), /"\/gks-hub"/);
  assert.doesNotMatch(readFileSync("src/app/sitemap.ts", "utf8"), /gks-hub/);
  const home = readFileSync("src/components/HomeTrackSections.tsx", "utf8");
  assert.ok(home.indexOf("{developerServices}") < home.indexOf("<CoDevelopmentCard"));
});
