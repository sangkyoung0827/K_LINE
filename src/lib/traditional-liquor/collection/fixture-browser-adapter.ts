import type { Page } from "playwright";
import type { BrowserSiteAdapter } from "@/lib/traditional-liquor/collection/browser";
import type { CollectionQuery, RawCollectedOffer } from "@/lib/traditional-liquor/collection/types";

export class FixtureBrowserSiteAdapter implements BrowserSiteAdapter {
  readonly sourceCode = "FIXTURE_BROWSER_PLAYWRIGHT_V1";
  readonly platformCode = "FIXTURE_SHOP";
  constructor(private readonly fixtureUrl: string) {}
  supports() { return true; }
  async collect(): Promise<RawCollectedOffer[]> { throw new Error("Use BrowserCollectionAdapter to run this site adapter."); }
  buildSearchUrl() { return this.fixtureUrl; }
  async waitForResults(page: Page) { await page.locator("[data-offer]").first().waitFor(); }
  async extractOffers(page: Page, query: CollectionQuery): Promise<RawCollectedOffer[]> {
    const rows = await page.locator("[data-offer]").evaluateAll((nodes) => nodes.map((node) => ({
      title: node.querySelector("[data-title]")?.textContent?.trim() ?? "",
      seller: node.querySelector("[data-seller]")?.textContent?.trim() ?? "",
      price: node.querySelector("[data-price]")?.textContent?.trim() ?? "",
      shipping: node.querySelector("[data-shipping]")?.textContent?.trim() ?? "",
      volume: node.querySelector("[data-volume]")?.textContent?.trim() ?? "",
      quantity: node.querySelector("[data-quantity]")?.textContent?.trim() ?? "",
      abv: node.querySelector("[data-abv]")?.textContent?.trim() ?? "",
      url: node.querySelector<HTMLAnchorElement>("[data-url]")?.href ?? ""
    })));
    const collectedAt = new Date().toISOString();
    return rows.map((row, index) => ({ sourceType: "BROWSER", sourceName: this.sourceCode, platformCode: this.platformCode, query: query.query, externalOfferId: `browser-fixture-${index + 1}`, listingTitle: row.title, sellerName: row.seller, priceText: row.price, shippingText: row.shipping, volumeText: row.volume, quantityText: row.quantity, abvText: row.abv, listingUrl: row.url, collectedAt, rawPayload: row }));
  }
}
