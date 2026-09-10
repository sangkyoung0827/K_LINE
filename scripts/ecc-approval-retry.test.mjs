import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

function harness(initialPaid = false) {
  let paid = initialPaid;
  let note = "";
  let rolePaid = initialPaid;
  let failRole = false;
  let roleWrites = 0;
  const roleWrite = async (next) => {
    roleWrites++;
    if (failRole) throw new Error("role storage unavailable");
    rolePaid = next;
  };
  const stubs = {
    "server-only": {},
    "@/lib/eccAccess": {
      approveEccOfficialMember: () => roleWrite(true),
      revokeEccOfficialMember: () => roleWrite(false),
    },
    "@/lib/eccMemberRegistrations": {
      patchEccMemberRegistrationWithChangeInfo: async (input) => {
        if (input.id === "missing") return { changed: false, registration: null };
        const paymentConfirmedChanged = paid !== input.paymentConfirmed;
        const changed = paymentConfirmedChanged || note !== input.adminNote;
        paid = input.paymentConfirmed;
        note = input.adminNote;
        return {
          changed, paymentConfirmedChanged,
          registration: { id: input.id, googleEmail: "member@example.test", paymentConfirmed: paid },
        };
      },
    },
  };
  const code = ts.transpileModule(readFileSync("src/lib/eccMemberAdminActions.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`)(
    (id) => { if (!(id in stubs)) throw new Error(`Unexpected dependency: ${id}`); return stubs[id]; },
    module, module.exports,
  );
  return {
    run: (paymentConfirmed, adminNote = "", id = "test") => module.exports.applyEccMemberAdminUpdate({
      adminEmail: "admin@example.test", adminNote, id, paymentConfirmed,
    }),
    fail: (value) => { failRole = value; },
    state: () => ({ paid, rolePaid, roleWrites }),
  };
}

test("approval failure remains an error; identical retry completes permission and returns row", async () => {
  const h = harness();
  h.fail(true);
  await assert.rejects(h.run(true), /role storage unavailable/);
  assert.deepEqual(h.state(), { paid: true, rolePaid: false, roleWrites: 1 });
  h.fail(false);
  const result = await h.run(true);
  assert.equal(result.changed, true);
  assert.equal(result.registration.paymentConfirmed, true);
  assert.deepEqual(h.state(), { paid: true, rolePaid: true, roleWrites: 2 });
});

test("revocation failure can also be retried without toggling the payment again", async () => {
  const h = harness(true);
  h.fail(true);
  await assert.rejects(h.run(false));
  h.fail(false);
  await h.run(false);
  assert.equal(h.state().rolePaid, false);
});

test("failed retry never returns success", async () => {
  const h = harness();
  h.fail(true);
  await assert.rejects(h.run(true));
  await assert.rejects(h.run(true));
  assert.equal(h.state().rolePaid, false);
});

test("note-only changes preserve role and missing registrations never write roles", async () => {
  const h = harness(true);
  await h.run(true, "note only");
  assert.equal(h.state().roleWrites, 0);
  const result = await h.run(false, "", "missing");
  assert.equal(result.registration, null);
  assert.equal(h.state().roleWrites, 0);
});
