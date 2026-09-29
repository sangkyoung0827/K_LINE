import assert from "node:assert/strict";
import test from "node:test";
import { filterResearchItems, isPublicResearch, researchDocumentType, toPublicResearchItem, type ResearchItem } from "./model";

const item = {
  id: "1", titleKo: "반구저기", titleEn: "Looking Within Yourself",
  subtitleKo: "", subtitleEn: "", summaryKo: "국궁 철학", summaryEn: "Archery philosophy",
  bodyKo: "본문", bodyEn: "Body", category: "Cultural Note", topic: "Korean Archery",
  tags: ["Philosophy", "Archery"], coverPath: "", imagePaths: [], attachmentPaths: [],
  authorName: "", authorOrganization: "HANHWAL", relatedOrganizationId: "hanhwal",
  relatedActivityId: "", quotes: [], references: [], status: "published", visibility: "public",
  isSample: false, createdBy: "", publishedAt: "", updatedAt: ""
} satisfies ResearchItem;

test("only approved public non-sample research can be read anonymously", () => {
  assert.equal(isPublicResearch(item), true);
  assert.equal(isPublicResearch({ ...item, status: "draft" }), false);
  assert.equal(isPublicResearch({ ...item, visibility: "private" }), false);
  assert.equal(isPublicResearch({ ...item, visibility: "members" }), false);
  assert.equal(isPublicResearch({ ...item, isSample: true }), false);
});

test("search combines title, tags, category, and organization filters", () => {
  const other = { ...item, id: "2", titleEn: "Tea", category: "Research Note", authorOrganization: "KLINE", tags: ["Tea"] };
  assert.deepEqual(filterResearchItems([item, other], { query: "philosophy", category: "Cultural Note", organization: "hanhwal", tag: "archery" }).map((value) => value.id), ["1"]);
  assert.deepEqual(filterResearchItems([item, other], { query: "tea", organization: "HANHWAL" }), []);
});

test("single search finds titles and article content, not unrelated tags", () => {
  const bodyOnly = { ...item, id: "3", titleKo: "차 문화", titleEn: "Tea Culture", summaryKo: "", summaryEn: "", bodyKo: "전통 다도의 역사", bodyEn: "Tea ceremony history", tags: ["HiddenLabel"] };
  assert.deepEqual(filterResearchItems([bodyOnly], { query: "다도의 역사" }).map((value) => value.id), ["3"]);
  assert.deepEqual(filterResearchItems([bodyOnly], { query: "Tea Culture" }).map((value) => value.id), ["3"]);
  assert.deepEqual(filterResearchItems([bodyOnly], { query: "HiddenLabel" }), []);
});

test("public records omit the editor account identifier", () => {
  assert.equal(toPublicResearchItem({ ...item, createdBy: "private@example.com" }).createdBy, "");
});

test("research documents include Korean word processor and presentation formats", () => {
  for (const extension of ["pdf", "docx", "hwp", "hwpx", "ppt", "pptx"]) {
    assert.equal(researchDocumentType(`document.${extension.toUpperCase()}`)?.extension, extension);
  }
  assert.equal(researchDocumentType("malware.exe"), null);
});
