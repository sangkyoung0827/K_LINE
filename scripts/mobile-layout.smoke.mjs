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
    assert.equal(await nav.getByRole("link").count(), 2);
    assert.equal(await nav.getByRole("button", { name: "My clubs" }).count(), 1);
    assert.equal(await nav.locator('[aria-current="page"]').getAttribute("href"), "/");
    if (width < 768) {
      const menu = page.locator('[aria-controls="kline-mobile-navigation"]');
      await menu.click();
      await page.locator('#kline-mobile-navigation button').filter({ hasText: "EN" }).click();
      assert.equal(await nav.isVisible(), false);
      await menu.press("Escape");
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
      assert.equal(await menu.evaluate((element) => element === document.activeElement), true);
      assert.equal(await nav.isVisible(), true);
      const cards = await page.locator('main a[href="/our-activities/ecc"], main a[href="/our-activities/hanhwal"], main a[href="/jeju"]').all();
      for (const card of cards) {
        const box = await card.boundingBox();
        assert.ok(box && box.height >= 44 && box.height <= 140);
      }
    }
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(geometry.document <= geometry.viewport + 1, `Horizontal overflow at ${width}px`);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(output, `home-${width}.png`), fullPage: true });
    await page.close();
    console.log(`PASS home, navigation and overflow: ${width}px`);
  }
} finally {
  await browser.close();
}
