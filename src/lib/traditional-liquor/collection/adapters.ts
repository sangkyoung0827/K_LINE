import type { CollectionQuery, RawCollectedOffer } from "@/lib/traditional-liquor/collection/types";

export interface CollectionAdapter {
  sourceCode: string;
  supports(query: CollectionQuery): boolean;
  collect(query: CollectionQuery): Promise<RawCollectedOffer[]>;
}

const fixtureListings = [
  { title: "명인 안동소주 45도", seller: "전통주 상점 A", price: "19,000원", shipping: "무료배송", volume: "375ml × 2", quantity: "2병", abv: "45%", url: "https://fixture.k-line.test/offers/andong-45" },
  { title: "안동소주 일품 21도", seller: "우리술 마켓", price: "13,500원", shipping: "3,000원", volume: "350ml", quantity: "1병", abv: "21도", url: "https://fixture.k-line.test/offers/andong-21" },
  { title: "복순도가 손막걸리", seller: "전통주 상점 B", price: "12,000원", shipping: "무료배송", volume: "935ml", quantity: "1병", abv: "6.5%", url: "https://fixture.k-line.test/offers/boksoondoga" },
  { title: "", seller: "오류 검증 상점", price: "가격문의", shipping: "", volume: "375ml", quantity: "1병", abv: "", url: "not-a-url" }
];

export function fixtureOffers(query: CollectionQuery, collectedAt = new Date().toISOString()): RawCollectedOffer[] {
  const matches = fixtureListings.filter((item) => !query.query.trim() || item.title.includes(query.query) || query.query === "전통주");
  const selected = matches.length ? matches : fixtureListings;
  return selected.map((item, index) => ({
    sourceType: "FIXTURE",
    sourceName: "FIXTURE_BROWSER_V1",
    platformCode: "FIXTURE_SHOP",
    query: query.query,
    externalOfferId: `fixture-${index + 1}`,
    listingTitle: item.title,
    sellerName: item.seller,
    priceText: item.price,
    shippingText: item.shipping,
    volumeText: item.volume,
    quantityText: item.quantity,
    abvText: item.abv,
    listingUrl: item.url,
    collectedAt,
    rawPayload: item
  }));
}

export class FixtureCollectionAdapter implements CollectionAdapter {
  readonly sourceCode = "FIXTURE_BROWSER_V1";
  supports() { return true; }
  async collect(query: CollectionQuery) { return fixtureOffers(query); }
}

export abstract class DisabledPolicyAdapter implements CollectionAdapter {
  abstract readonly sourceCode: string;
  supports() { return false; }
  async collect(): Promise<RawCollectedOffer[]> {
    throw new Error("DISABLED_REQUIRES_APPROVED_ACCESS");
  }
}

export class NaverDisabledAdapter extends DisabledPolicyAdapter { readonly sourceCode = "NAVER_DISABLED_REQUIRES_APPROVED_ACCESS"; }
export class KakaoGiftDisabledAdapter extends DisabledPolicyAdapter { readonly sourceCode = "KAKAO_GIFT_DISABLED_REQUIRES_APPROVED_ACCESS"; }

export class ManualImportAdapter implements CollectionAdapter {
  readonly sourceCode = "MANUAL_IMPORT";
  constructor(private readonly rows: RawCollectedOffer[]) {}
  supports() { return true; }
  async collect() { return this.rows; }
}
