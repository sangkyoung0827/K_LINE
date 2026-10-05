import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

test("desktop and mobile forms UI: draft, edit, approve, mirror and no horizontal overflow", { timeout: 90_000 }, async () => {
  const server = spawn(process.execPath, ["scripts/google-forms-ui-server.mjs"], { stdio: ["ignore", "pipe", "pipe"] });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Fixture startup timed out")), 20_000);
      server.stdout.on("data", (chunk) => { if (String(chunk).includes("UI fixture:")) { clearTimeout(timeout); resolve(); } });
      server.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Fixture exited ${code}`)); });
    });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:3317");
    await page.getByRole("heading", { name: "Application management" }).waitFor();
    await page.getByLabel("Google Forms activity command").fill("구글폼 Gathering 만들어줘");
    await page.getByRole("button", { name: "Send command" }).click();
    await page.getByText("행사명과 정확한 일시·장소·마감을 입력해주세요.").waitFor();
    await page.getByRole("tab", { name: "Google Forms", exact: true }).click();
    await page.getByLabel("활동 제목", { exact: true }).fill("ECC Gathering UI Test");
    assert.equal(await page.getByLabel("Activity date", { exact: true }).count(), 0);
    assert.equal(await page.getByLabel("Deadline", { exact: true }).count(), 0);
    assert.equal(await page.getByLabel("Location", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "신청폼 · 공지 생성", exact: true }).click();
    await page.getByRole("button", { name: "생성 완료", exact: true }).waitFor();
    const notice = await page.getByLabel("생성된 공지문").inputValue();
    assert.match(notice, /ECC Gathering UI Test/);
    assert.ok(notice.endsWith("https://docs.google.com/forms/d/e/test-fixture/viewform"));
    assert.equal(notice.includes("{{GOOGLE_FORM_URL}}"), false);
    await mkdir("artifacts/google-forms", { recursive: true });
    await page.screenshot({ path: "artifacts/google-forms/desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole("tab", { name: "신청자 관리", exact: true }).click();
    await page.getByRole("button", { name: "View mirror", exact: true }).click();
    await page.getByText("Test Participant", { exact: true }).waitFor();
    await page.getByText("Friday, Saturday", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: "artifacts/google-forms/mobile.png", fullPage: true });
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close(); server.kill("SIGTERM");
    if (server.exitCode === null) await new Promise((resolve) => server.once("exit", resolve));
  }
});
