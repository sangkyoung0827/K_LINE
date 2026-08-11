import "server-only";

import type { Browser, BrowserContext, Page } from "playwright";
import type { CollectionAdapter } from "@/lib/traditional-liquor/collection/adapters";
import type { CollectionQuery, RawCollectedOffer } from "@/lib/traditional-liquor/collection/types";

export interface BrowserProvider {
  launch(): Promise<Browser>;
}

export class PlaywrightBrowserProvider implements BrowserProvider {
  async launch() {
    const { chromium } = await import("playwright");
    return chromium.launch({ headless: true });
  }
}

export class BrowserManager {
  constructor(private readonly provider: BrowserProvider, private readonly timeoutMs = 15_000) {}

  async withPage<T>(work: (page: Page) => Promise<T>) {
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    try {
      browser = await this.provider.launch();
      context = await browser.newContext();
      const page = await context.newPage();
      page.setDefaultTimeout(this.timeoutMs);
      return await work(page);
    } finally {
      await context?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
    }
  }
}

export interface BrowserSiteAdapter extends CollectionAdapter {
  platformCode: string;
  buildSearchUrl(query: string): string;
  waitForResults(page: Page): Promise<void>;
  extractOffers(page: Page, query: CollectionQuery): Promise<RawCollectedOffer[]>;
}

export class BrowserCollectionAdapter implements CollectionAdapter {
  readonly sourceCode: string;
  constructor(private readonly manager: BrowserManager, private readonly site: BrowserSiteAdapter) {
    this.sourceCode = site.sourceCode;
  }
  supports(query: CollectionQuery) { return this.site.supports(query); }
  collect(query: CollectionQuery) {
    return this.manager.withPage(async (page) => {
      await page.goto(this.site.buildSearchUrl(query.query), { waitUntil: "domcontentloaded" });
      await this.site.waitForResults(page);
      return this.site.extractOffers(page, query);
    });
  }
}
