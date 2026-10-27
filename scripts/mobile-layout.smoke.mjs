import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";

// Run against a local production build. Never logs in or writes member data.
const base = process.env.MOBILE_PREVIEW_URL || "http://127.0.0.1:3301";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Use a local preview only.");
const output = process.env.MOBILE_SCREENSHOT_DIR || join(tmpdir(), "kline-mobile-screenshots");
await mkdir(output, { recursive: true });
const browser = await chromium.launch();

async function openAssistant(page, width) {
  if (width < 768 || width >= 1024) {
    const launcher = page.locator(width < 768 ? '.mobile-bottom-nav [aria-controls="global-woohyukmon"]' : 'header [aria-controls="global-woohyukmon"]');
    await launcher.click();
    return launcher;
  }
  const menu = page.locator('[aria-controls="kline-mobile-navigation"]');
  await menu.click();
  await page.locator('#kline-mobile-navigation').getByRole("button", { name: "Woohyukmon", exact: true }).click();
  return menu;
}

async function checkWideAnswer(width) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 768 });
  const email = "layout-test@example.invalid";
  const summary = "신청 건수와 실제 참석 기록을 구분한 격리된 화면 검증용 답변입니다. ".repeat(8)
    + " A-long-unbroken-reference-" + "x".repeat(200);
  const requests = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  // All API requests are fixtures: no real login, model calls or conversation writes.
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    requests.push(`${method} ${path}`);
    let json = {};
    if (path === "/api/auth/session") json = { user: { email, name: "Layout Test" }, expires: "2099-01-01T00:00:00.000Z" };
    else if (path === "/api/co-development/catalog") json = [];
    else if (path === "/api/woohyukmon/club-assistant" && method === "GET") json = { email, scopes: ["ecc", "hanhwal"], roles: { ecc: "admin" }, readOnly: false };
    else if (path === "/api/woohyukmon/club-assistant" && method === "POST") json = {
      handled: true, kind: "answer", title: "ECC layout test", summary,
      rows: [Object.fromEntries(Array.from({ length: 28 }, (_, index) => [`evidence_column_${index}`, `isolated-value-${index}`]))]
    };
    else if (path === "/api/woohyukmon/chats") json = { chat: { id: "isolated-layout-chat" } };
    await route.fulfill({ status: 200, json });
  });
  try {
    await page.goto(base);
    await openAssistant(page, width);
    const dialog = page.getByRole("dialog", { name: "Woohyukmon", exact: true });
    await dialog.getByRole("combobox").selectOption("ecc");
    await dialog.getByRole("textbox").fill("ECC 신청 건수와 실제 참석 기록을 구분해 조회만 해주세요. ".repeat(6));
    await dialog.getByRole("button", { name: "Send", exact: true }).click();
    const table = dialog.locator("[data-woohyukmon-table]");
    await table.waitFor();
    await page.waitForFunction(() => !document.querySelector('[role="dialog"] [role="status"]'));
    const geometry = await dialog.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return {
        messages: [...element.querySelectorAll("[data-woohyukmon-message]")].map(message => {
          const box = message.getBoundingClientRect();
          const text = message.firstElementChild;
          return { withinDialog: box.left >= bounds.left && box.right <= bounds.right,
            overflow: message.scrollWidth > message.clientWidth + 1,
            textOverflow: text.scrollWidth > text.clientWidth + 1,
            textHeight: text.getBoundingClientRect().height,
            lineHeight: Number.parseFloat(getComputedStyle(text).lineHeight) };
        }),
        tableScrollable: element.querySelector("[data-woohyukmon-table]").scrollWidth
          > element.querySelector("[data-woohyukmon-table]").clientWidth + 1
      };
    });
    assert.equal(geometry.messages.length, 2);
    for (const message of geometry.messages) {
      assert.ok(message.withinDialog && !message.overflow && !message.textOverflow, `Clipped message at ${width}px: ${JSON.stringify(message)}`);
      assert.ok(message.textHeight > message.lineHeight * 2, `Text did not wrap at ${width}px`);
    }
    assert.ok(geometry.tableScrollable, `Wide evidence table must scroll independently at ${width}px`);
    await table.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    assert.ok(await table.evaluate(element => element.scrollLeft > 0));
    assert.ok(requests.includes("POST /api/woohyukmon/club-assistant"));
    assert.ok(!requests.includes("POST /api/gemini"));
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(output, `woohyukmon-wide-answer-${width}.png`) });
    console.log(`PASS wrapped messages and independently scrolling evidence table: ${width}px`);
  } finally {
    await page.close();
  }
}

try {
  for (const width of [320, 390, 430, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 768 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.locator('header a[href^="/login?"]').waitFor({ state: "attached" });
    const nav = page.locator(".mobile-bottom-nav");
    assert.equal(await nav.isVisible(), width < 768);
    assert.equal(await nav.locator("a").count(), 1);
    assert.equal(await nav.locator('button[aria-controls="global-woohyukmon"]').count(), 1);
    assert.equal(await nav.locator('button[aria-controls="mobile-my-clubs"]').count(), 1);
    assert.equal(await nav.locator('[aria-current="page"]').getAttribute("href"), "/");
    if (width < 768) {
      const menu = page.locator('[aria-controls="kline-mobile-navigation"]');
      await menu.click();
      await page.locator('#kline-mobile-navigation button').filter({ hasText: "EN" }).click();
      assert.equal(await nav.isVisible(), false);
      const mobileMenu = page.locator('#kline-mobile-navigation');
      assert.equal(await mobileMenu.getByRole("button", { name: "Woohyukmon", exact: true }).count(), 1);
      assert.equal(await mobileMenu.locator('a[href^="/jeju"]').count(), 0);
      assert.equal(await mobileMenu.locator("summary").count(), 2);
      const eccMenu = mobileMenu.locator('[data-club-menu="ecc"]');
      assert.equal(await eccMenu.getByRole("link", { name: "ECC home", exact: true }).isVisible(), false);
      await eccMenu.locator("summary").click();
      assert.equal(await eccMenu.getByRole("link", { name: "ECC home", exact: true }).isVisible(), true);
      await eccMenu.locator("summary").press("Enter");
      assert.equal(await eccMenu.getByRole("link", { name: "ECC home", exact: true }).isVisible(), false);
      await menu.press("Escape");
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
      assert.equal(await menu.evaluate((element) => element === document.activeElement), true);
      assert.equal(await nav.isVisible(), true);
      const cards = await page.locator('main a[href="/our-activities/ecc"], main a[href="/our-activities/hanhwal"], main a[href="/co-development"]').all();
      for (const card of cards) {
        const box = await card.boundingBox();
        assert.ok(box && box.height >= 44 && box.height <= 140, `Compact home card ${await card.getAttribute("href")} at ${width}px: ${JSON.stringify(box)}`);
      }
      await menu.click();
      await page.locator('#kline-mobile-navigation').getByRole("button", { name: "Woohyukmon", exact: true }).click();
      const menuDialog = page.getByRole("dialog", { name: "Woohyukmon", exact: true });
      await menuDialog.waitFor({ state: "visible" });
      assert.equal(await page.locator('#kline-mobile-navigation').count(), 0);
      await menuDialog.getByRole("button", { name: "Close Woohyukmon", exact: true }).press("Escape");
      await menuDialog.waitFor({ state: "hidden" });
      assert.equal(await menu.evaluate(element => element === document.activeElement), true);
      assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    }
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(geometry.document <= geometry.viewport + 1, `Horizontal overflow at ${width}px`);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(output, `home-${width}.png`), fullPage: true });
    assert.equal(await page.locator('main a[href="/co-development"]').count(), 1);
    assert.equal(await page.locator('[data-home-woohyukmon]').count(), 0);
    const launcher = await openAssistant(page, width);
    const dialog = page.getByRole("dialog", { name: "Woohyukmon", exact: true });
    await dialog.waitFor({ state: "visible" });
    const close = dialog.getByRole("button", { name: "Close Woohyukmon", exact: true });
    assert.equal(await close.evaluate(element => element === document.activeElement), true);
    const bounds = await dialog.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= 901);
    if (width < 768) {
      assert.equal(await nav.isVisible(), false);
      assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    }
    await dialog.getByRole("textbox").fill("한국 문화 행사 / K_LINE activities\n".repeat(25));
    const send = await dialog.getByRole("button", { name: "Send", exact: true }).boundingBox();
    assert.ok(send && send.width >= 44 && send.height >= 44 && send.y + send.height <= 901);
    await page.screenshot({ path: join(output, `woohyukmon-${width}.png`), fullPage: false });
    await close.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await launcher.evaluate(element => element === document.activeElement), true);
    await page.goto(`${base}/co-development`);
    await page.waitForURL(url => url.pathname === "/login" && url.searchParams.get("callbackUrl") === "/co-development");
    await page.goto(`${base}/jeju/profile`);
    await page.getByRole("heading", { name: /Memory Book in Woohyukmon|추억록은 우혁몬 앱에서/ }).waitFor();
    assert.equal(await page.getByRole("textbox").count(), 0);
    await page.close();
    console.log(`PASS home, navigation, dialog, app notice and overflow: ${width}px`);
    await checkWideAnswer(width);
  }
} finally {
  await browser.close();
}
