import assert from "node:assert/strict";
import test from "node:test";
import { internalTestControls } from "./internalTest";
import type { GoogleFormRegistryRow } from "./types";

const now = Date.parse("2026-10-16T12:00:00Z");
const row = { id: "test-a", google_form_id: "google-a", club_key: "ecc", title: "ECC internal test", status: "draft" } as GoogleFormRegistryRow;
const grant = { registryId: row.id, googleFormId: row.google_form_id, issuedAt: "2026-10-16T11:00:00Z", expiresAt: "2026-10-16T13:00:00Z" };
test("internal grant pins both IDs and cannot enable other or non-test forms", () => {
  assert.equal(internalTestControls(row, JSON.stringify([grant]), now).canOpen, true);
  for (const patch of [{ id: "test-b" }, { google_form_id: "google-b" }, { title: "Real recruitment" }, { club_key: "jeju" }, { status: "archived" }]) {
    assert.deepEqual(internalTestControls({ ...row, ...patch } as GoogleFormRegistryRow, JSON.stringify([grant]), now), { canOpen: false, canClose: false });
  }
});
test("missing, malformed, oversized and unbounded grants fail closed", () => {
  for (const configuration of ["", "{", "null", "{}", "[]", JSON.stringify([grant, grant, grant]), JSON.stringify([{ ...grant, issuedAt: "bad" }]), JSON.stringify([{ ...grant, issuedAt: "2026-10-17T12:00:00Z" }]), JSON.stringify([{ ...grant, expiresAt: "2026-10-20T12:00:00Z" }])]) {
    assert.equal(internalTestControls(row, configuration, now).canOpen, false);
  }
});
test("expiry blocks reopening but keeps an already-open pinned form closable", () => {
  const configuration = JSON.stringify([grant]);
  assert.deepEqual(internalTestControls(row, configuration, now + 3600000), { canOpen: false, canClose: false });
  assert.deepEqual(internalTestControls({ ...row, status: "open" }, configuration, now + 3600000), { canOpen: false, canClose: true });
});
