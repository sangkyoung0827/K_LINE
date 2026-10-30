import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadJoinModule } from "./lib/hanhwal-join-harness.mjs";

const seo = loadJoinModule("src/lib/seo.ts", {}, { process: { env: {} } });
const mocks = {
  "@/lib/seo": seo,
  "@/lib/hanhwalPublic": { hanhwalFacts: { instagram: "https://www.instagram.com/jbnu_hanhwal/", map: "https://naver.me/xiqZiOei" } },
  "@/components/HanhwalPublicShell": { HanhwalPublicShell: ({ children }) => children },
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "next/image": { default: ({ fill, priority, ...props }) => React.createElement("img", props) },
  "./hanhwal.module.css": { default: {} }
};
function nodes(tree, type) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}

test("Hanhwal has bilingual visible identity, a single canonical URL and linked public organization data", () => {
  const page = loadJoinModule("src/app/our-activities/hanhwal/page.tsx", mocks);
  const canonical = "https://kline-nine-wheat.vercel.app/our-activities/hanhwal";
  assert.equal(page.metadata.alternates.canonical, canonical);
  assert.equal(page.metadata.robots.index, true);
  assert.match(page.metadata.title, /한활 Hanhwal/);
  assert.match(page.metadata.description, /K_LINE 한활/);
  assert.equal(page.metadata.openGraph.images[0].width, 2000);
  const tree = page.default();
  assert.equal(nodes(tree, "h1").length, 1);
  assert.equal(renderToStaticMarkup(nodes(tree, "h1")[0]), "<h1>한활 Hanhwal</h1>");
  const graph = JSON.parse(nodes(tree, "script")[0].props.dangerouslySetInnerHTML.__html)["@graph"];
  const organization = graph.find((node) => node["@type"] === "SportsOrganization");
  const webPage = graph.find((node) => node["@type"] === "WebPage");
  assert.equal(organization.url, canonical);
  assert.equal(webPage.mainEntity["@id"], organization["@id"]);
  assert.equal(webPage.isPartOf["@id"], "https://kline-nine-wheat.vercel.app/#website");
  assert.equal(graph.find((node) => node["@type"] === "BreadcrumbList").itemListElement.at(-1).item, canonical);
  assert.equal(organization.parentOrganization, undefined, "do not claim an unapproved official university affiliation");
});

test("public club pages and the legacy redirect are crawlable while operational/private paths stay blocked", () => {
  const rules = loadJoinModule("src/app/robots.ts", mocks).default().rules[0];
  const allowed = (path) => {
    const matches = [...rules.allow.filter((entry) => path.startsWith(entry)).map((entry) => ({ entry, allow: true })), ...rules.disallow.filter((entry) => path.startsWith(entry)).map((entry) => ({ entry, allow: false }))];
    matches.sort((a, b) => b.entry.length - a.entry.length || Number(b.allow) - Number(a.allow));
    return matches[0]?.allow ?? true;
  };
  for (const path of ["/our-activities/hanhwal", "/our-activities/hanhwal/gallery", "/our-activities/hanhwal/activities", "/han-hwal"]) assert.equal(allowed(path), true, path);
  for (const path of ["/hanhwal-join", "/hanhwal-official", "/our-activities/hanhwal/members", "/our-activities/hanhwal/operations", "/api/hanhwal/team-chat"]) assert.equal(allowed(path), false, path);
  const map = loadJoinModule("src/app/sitemap.ts", { ...mocks, "@/data/activities": { publicActivities: [] } }).default();
  assert.equal(map.filter((entry) => entry.url === "https://kline-nine-wheat.vercel.app/our-activities/hanhwal").length, 1);
  assert.equal(map.some((entry) => /hanhwal-join|hanhwal-official|\/han-hwal$|\/members$/.test(entry.url)), false);
  const redirect = loadJoinModule("src/app/han-hwal/page.tsx", { ...mocks, "next/navigation": { permanentRedirect: (path) => { throw new Error(`308:${path}`); } } });
  assert.throws(() => redirect.default(), /308:\/our-activities\/hanhwal/);
});
