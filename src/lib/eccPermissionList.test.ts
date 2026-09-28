import assert from "node:assert/strict";
import test from "node:test";
import { getEccPermissionEmails, hasEccMembershipHistory } from "./eccPermissionList";
import type { EccRoleRow } from "./eccAccess";

const emptyRole = {
  payment_confirmed: false,
  is_official_member: false,
  official_member_status: "none",
  admin_status: "none",
  super_admin_status: "none",
  role: "user"
} as EccRoleRow;

test("unrelated site users and empty ECC roles are excluded", () => {
  assert.equal(hasEccMembershipHistory(emptyRole), false);
});

test("existing ECC payment, approval, and role histories remain visible", () => {
  for (const state of [
    { payment_confirmed: true },
    { is_official_member: true },
    { official_member_status: "approved" },
    { official_member_status: "rejected" },
    { admin_status: "requested" },
    { super_admin_status: "approved" },
    { role: "official_member" }
  ]) {
    assert.equal(hasEccMembershipHistory({ ...emptyRole, ...state }), true);
  }
});

test("permission list includes ECC applicants but not unrelated site accounts", () => {
  assert.deepEqual(
    getEccPermissionEmails(
      [{ google_email: " Pending@Example.com " }],
      [
        { ...emptyRole, email: "unrelated@example.com" },
        { ...emptyRole, email: "approved@example.com", payment_confirmed: true },
        { ...emptyRole, email: "PENDING@example.com" }
      ]
    ),
    ["approved@example.com", "pending@example.com"]
  );
});
