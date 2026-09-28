import assert from "node:assert/strict";
import { test } from "node:test";
import { canPreviewResource, maxResourceBytes, resourceMime, validateResourceFile } from "./model";

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
