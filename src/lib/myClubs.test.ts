import assert from "node:assert/strict";
import { test } from "node:test";
import { loadMyClubs, resolveMyClubStatus } from "./myClubs";

const owner = "member@example.invalid";
const access = { email: owner, isLoggedIn: true, isOfficialMember: false, role: "user" };
const registration = { googleEmail: owner, officialMember: true, status: "approved" };

test("only the current account's club registration appears as joined", () => {
  assert.equal(resolveMyClubStatus({ access, registration }, owner), "member");
  assert.equal(resolveMyClubStatus({ access, registration }, " MEMBER@example.invalid "), "member");
  assert.equal(resolveMyClubStatus({ access, registration }, "other@example.invalid"), "unavailable");
  assert.equal(resolveMyClubStatus({ access, registration: { ...registration, googleEmail: "other@example.invalid" } }, owner), "unavailable");
});

test("pending, rejected and absent memberships remain distinct", () => {
  for (const status of ["submitted", "payment_pending"]) {
    assert.equal(resolveMyClubStatus({ access, registration: { ...registration, officialMember: false, status } }, owner), "pending");
  }
  assert.equal(resolveMyClubStatus({ access, registration: { ...registration, officialMember: false, status: "rejected" } }, owner), "none");
  assert.equal(resolveMyClubStatus({ access, registration: null }, owner), "none");
});

test("global privileged visibility alone does not enroll a user in either club", () => {
  for (const role of ["admin", "super_admin", "developer"]) {
    assert.equal(resolveMyClubStatus({ access: { ...access, role, isOfficialMember: true }, registration: null }, owner), "none");
  }
  assert.equal(resolveMyClubStatus({ access: { ...access, role: "official_member", isOfficialMember: true }, registration: null }, owner), "member");
});

test("lookup failures and malformed responses are not reported as no membership", () => {
  for (const data of [null, {}, { access }, { access: { ...access, lookupFailed: true }, registration: null }]) {
    assert.equal(resolveMyClubStatus(data, owner), "unavailable");
  }
  assert.equal(resolveMyClubStatus({ access: { isLoggedIn: false } }, owner), "unauthenticated");
});

test("club reads are independent, uncached and read-only without an email parameter", async () => {
  const calls: string[] = [];
  const result = await loadMyClubs(owner, new AbortController().signal, async (url, options) => {
    calls.push(String(url));
    assert.equal(options?.method, "GET");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.credentials, "same-origin");
    assert.equal(options?.body, undefined);
    return Response.json({ access, registration: String(url).includes("/ecc/") ? registration : null });
  });
  assert.deepEqual(calls.sort(), ["/api/ecc/member-registration", "/api/hanhwal/member-registration"]);
  assert.deepEqual(result, [{ id: "ecc", status: "member" }, { id: "hanhwal", status: "none" }]);
});

test("one unavailable club does not remove another joined club; retry reads fresh", async () => {
  const first = await loadMyClubs(owner, new AbortController().signal, async (url) =>
    String(url).includes("/ecc/") ? Response.json({ access, registration }) : new Response("", { status: 503 }));
  assert.deepEqual(first, [{ id: "ecc", status: "member" }, { id: "hanhwal", status: "unavailable" }]);
  const retry = await loadMyClubs(owner, new AbortController().signal, async () => Response.json({ access, registration }));
  assert.ok(retry.every((item) => item.status === "member"));
});

test("unauthenticated responses and transport cancellation do not fabricate club membership", async () => {
  const guest = await loadMyClubs(owner, new AbortController().signal, async () => new Response("", { status: 401 }));
  assert.ok(guest.every((item) => item.status === "unauthenticated"));
  const controller = new AbortController();
  controller.abort();
  const stopped = await loadMyClubs(owner, controller.signal, async (_, options) => {
    assert.equal(options?.signal?.aborted, true);
    throw new Error("aborted");
  });
  assert.ok(stopped.every((item) => item.status === "unavailable"));
});
