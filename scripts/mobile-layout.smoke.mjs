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

try {
  for (const width of [320, 390, 430, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 768 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    const nav = page.locator(".mobile-bottom-nav");
    assert.equal(await nav.isVisible(), width < 768);
    assert.equal(await nav.getByRole("link").count(), 1);
    assert.equal(await nav.getByRole("button", { name: /Woohyukmon|우혁몬/ }).count(), 1);
    assert.equal(await nav.getByRole("button", { name: "My clubs" }).count(), 1);
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
      const cards = await page.locator('main a[href="/our-activities/ecc"], main a[href="/our-activities/hanhwal"], main [data-home-woohyukmon]').all();
      for (const card of cards) {
        const box = await card.boundingBox();
        assert.ok(box && box.height >= 44 && box.height <= 140);
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
    const launcher = width < 768 ? nav.getByRole("button", { name: /Woohyukmon|우혁몬/ }) : width >= 1024 ? page.locator('header [aria-controls="global-woohyukmon"]') : page.locator('[data-home-woohyukmon]');
    await launcher.click();
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
    await page.goto(`${base}/jeju/profile`);
    await page.getByRole("heading", { name: /Memory Book in Woohyukmon|추억록은 우혁몬 앱에서/ }).waitFor();
    assert.equal(await page.getByRole("textbox").count(), 0);
    await page.close();
    console.log(`PASS home, navigation, dialog, app notice and overflow: ${width}px`);
  }
} finally {
  await browser.close();
}
