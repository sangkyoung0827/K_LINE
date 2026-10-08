import assert from "node:assert/strict";
import { test } from "node:test";
import { canPreviewResource, filterResources, isResourceCategory, maxResourceBytes, normalizeResourceCategory, resourceCategories, resourceCategoryLabel, resourceMime, validateResourceFile, type EccResource } from "./model";

test("common ECC documents and images are accepted within 50 MB", () => {
  for (const fileName of ["slides.ppt", "slides.pptx", "photo.jpg", "report.pdf", "table.xlsx", "notice.hwpx", "notice.hwp", "archive.zip", "clip.mp4"]) {
    const mimeType = resourceMime(fileName);
    assert.ok(mimeType);
    assert.equal(validateResourceFile(fileName, maxResourceBytes, mimeType).mimeType, mimeType);
  }
});

test("unsafe names, executables, mismatched types and oversized files are rejected", () => {
  for (const fileName of ["../slides.pptx", "a\\b.pdf", "script.html", "program.exe", "image.svg", "note\n.pdf"]) {
    assert.throws(() => validateResourceFile(fileName, 10, resourceMime(fileName)));
  }
  assert.throws(() => validateResourceFile("slides.pptx", maxResourceBytes + 1, resourceMime("slides.pptx")));
  assert.throws(() => validateResourceFile("slides.pptx", 10, "text/html"));
});

test("browser preview is limited to safe display formats", () => {
  assert.equal(canPreviewResource("image/jpeg"), true);
  assert.equal(canPreviewResource("application/pdf"), true);
  assert.equal(canPreviewResource("application/vnd.openxmlformats-officedocument.presentationml.presentation"), false);
  assert.equal(canPreviewResource("application/zip"), false);
});

test("resource categories cover ECC materials and safely normalize legacy rows", () => {
  assert.deepEqual(resourceCategories.map((category) => category.id), ["class-research", "notice", "mt", "special-event", "other"]);
  for (const category of resourceCategories) {
    assert.equal(isResourceCategory(category.id), true);
    assert.ok(resourceCategoryLabel(category.id, "ko"));
    assert.ok(resourceCategoryLabel(category.id, "en"));
  }
  for (const value of [undefined, null, "", "unknown", { id: "notice" }]) {
    assert.equal(normalizeResourceCategory(value), "other");
    assert.equal(isResourceCategory(value), false);
  }
});

test("category and text filters combine without changing the original resources", () => {
  const base: EccResource = { id: "1", title: "영어 수업", description: "Conversation guide", category: "class-research", fileName: "slides.pptx", mimeType: "application/pdf", sizeBytes: 20, uploaderName: "ECC", createdAt: "2026-10-09", publishedAt: "2026-10-09" };
  const resources: EccResource[] = [base, { ...base, id: "2", title: "MT 안내", category: "mt", description: "Trip information" }, { ...base, id: "3", title: "이전 자료", category: undefined as unknown as EccResource["category"] }];
  assert.deepEqual(filterResources(resources, "", "all").map((item) => item.id), ["1", "2", "3"]);
  assert.deepEqual(filterResources(resources, " conversation ", "class-research").map((item) => item.id), ["1"]);
  assert.deepEqual(filterResources(resources, "Trip", "class-research"), []);
  assert.deepEqual(filterResources(resources, "SLIDES", "mt").map((item) => item.id), ["2"]);
  assert.deepEqual(filterResources(resources, "", "other").map((item) => item.id), ["3"]);
  assert.equal(resources.length, 3);
  assert.equal(resources[0], base);
});
