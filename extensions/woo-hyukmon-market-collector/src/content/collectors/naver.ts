const NaverCollector: PlatformCollector = {
  code: "NAVER",
  supports(url) { return new URL(url).hostname === "search.shopping.naver.com"; },
  async collect(query) {
    if (detectedAccessBlock()) throw new Error("네이버가 접근 제한 또는 확인 화면을 표시했습니다. 우회하지 않고 수집을 중지했습니다.");
    const fromNextData = collectNaverNextData(query);
    const items = fromNextData.length ? fromNextData : collectNaverDom(query);
    return {
      items: dedupeNaverItems(items),
      scannedCount: Math.max(items.length, document.querySelectorAll("[data-nclick*='i:'], [class*='product_item'], [class*='productItem']").length),
      skippedItems: 0,
      warnings: fromNextData.length ? [] : ["__NEXT_DATA__에서 상품 목록을 찾지 못해 공개 DOM을 기준으로 수집했습니다."]
    };
  }
};

function collectNaverNextData(query: string) {
  const script = document.querySelector<HTMLScriptElement>("script#__NEXT_DATA__");
  if (!script?.textContent) return [];
  try {
    const root = JSON.parse(script.textContent) as unknown;
    const candidates: Record<string, any>[] = [];
    walkNaverJson(root, candidates, new WeakSet<object>());
    return candidates.flatMap((candidate, index) => naverCandidateItems(candidate, query, index + 1));
  } catch { return []; }
}

function walkNaverJson(value: unknown, output: Record<string, any>[], seen: WeakSet<object>) {
  if (!value || typeof value !== "object" || seen.has(value as object)) return;
  seen.add(value as object);
  if (!Array.isArray(value)) {
    const item = value as Record<string, any>;
    const name = item.productName ?? item.productTitle ?? item.title ?? item.name;
    const id = item.id ?? item.productId ?? item.catalogId ?? item.nvMid;
    if (name && id && (item.price !== undefined || item.lowPrice !== undefined || item.mallProductUrl || item.productUrl)) output.push(item);
  }
  Object.values(value as Record<string, unknown>).forEach((child) => walkNaverJson(child, output, seen));
}

function naverCandidateItems(candidate: Record<string, any>, query: string, rank: number): MarketItem[] {
  const name = String(candidate.productName ?? candidate.productTitle ?? candidate.title ?? candidate.name ?? "").trim();
  const catalogId = String(candidate.catalogId ?? candidate.nvMid ?? candidate.productId ?? candidate.id ?? "").trim();
  if (!name || !catalogId) return [];
  const lowMalls = Array.isArray(candidate.lowMallList) ? candidate.lowMallList : [];
  if (lowMalls.length) {
    const catalog = makeNaverItem(candidate, query, rank, "CATALOG", catalogId, undefined, true);
    const offers = lowMalls.flatMap((mall: Record<string, any>, index: number) => {
      const merged = { ...candidate, ...mall, productName: name, reviewCountSum: undefined, keepCnt: undefined, scoreInfo: undefined, purchaseCnt: mall.purchaseCnt };
      const offerId = String(mall.mallProductId ?? mall.productId ?? `${catalogId}:${mall.mallName ?? index}`);
      const item = makeNaverItem(merged, query, rank, "OFFER", offerId, String(mall.mallName ?? mall.mallNm ?? "").trim(), false);
      return item ? [item] : [];
    });
    return [...(catalog ? [catalog] : []), ...offers];
  }
  const item = makeNaverItem(candidate, query, rank, candidate.catalogId ? "CATALOG" : "OFFER", catalogId, undefined, Boolean(candidate.catalogId));
  return item ? [item] : [];
}

function makeNaverItem(candidate: Record<string, any>, query: string, rank: number, scope: MetricScope, sourceId: string, sellerOverride?: string, catalog = false): MarketItem | null {
  const productName = String(candidate.productName ?? candidate.productTitle ?? candidate.title ?? candidate.name ?? "").replace(/<[^>]+>/g, "").trim();
  const price = compactNumber(candidate.price ?? candidate.lowPrice ?? candidate.salePrice);
  if (!productName || price === undefined) return null;
  const sellerName = sellerOverride || String(candidate.mallName ?? candidate.mallNm ?? candidate.brandName ?? (catalog ? "네이버 가격비교" : "네이버쇼핑")).trim();
  const listingUrl = absoluteUrl(candidate.mallProductUrl ?? candidate.productUrl ?? candidate.link ?? candidate.url);
  const purchase = catalog && Number(candidate.purchaseCnt) === 0 ? null : metric("SOURCE_PURCHASE_COUNT", candidate.purchaseCnt ?? candidate.purchaseCount, scope);
  const metrics = uniqueMetrics([
    purchase,
    metric("KEEP_COUNT", candidate.keepCnt ?? candidate.keepCount, scope),
    metric("REVIEW_COUNT", candidate.reviewCountSum ?? candidate.reviewCount, scope),
    metric("RATING", candidate.scoreInfo ?? candidate.rating, scope),
    metric("SEARCH_RANK", candidate.rank ?? rank, scope)
  ]);
  return {
    identity: { externalOfferId: scope === "OFFER" ? sourceId : undefined, sourceEntityId: sourceId, metricScope: scope },
    product: { productName, sellerName, brandName: candidate.brandName, listingUrl },
    offer: { price, originalPrice: compactNumber(candidate.originalPrice), shippingFee: compactNumber(candidate.deliveryFee), volumeMl: volumeFromName(productName), quantity: 1 },
    metrics,
    provenance: { platformCode: "NAVER", query, sourceUrl: location.href, collectedAt: new Date().toISOString(), collectorVersion: "NAVER_V1" }
  };
}

function collectNaverDom(query: string) {
  const roots = [...document.querySelectorAll<HTMLElement>("[class*='product_item'], [class*='productItem'], li[class*='product']")];
  return roots.flatMap((root, index) => {
    const link = root.querySelector<HTMLAnchorElement>("a[href]");
    const name = textOf(root, ["[class*='product_title']", "[class*='productName']", "a[title]"]) || link?.title || "";
    const price = compactNumber(textOf(root, ["[class*='price_num']", "[class*='price']"]));
    if (!name || price === undefined) return [];
    const url = absoluteUrl(link?.href);
    const id = new URL(url).searchParams.get("nvMid") || root.dataset.nvMid || `dom:${index}:${name}`;
    const scope: MetricScope = /가격비교/.test(root.innerText) ? "CATALOG" : "OFFER";
    const item = makeNaverItem({ productName: name, price, productUrl: url, mallName: textOf(root, ["[class*='mall']", "[class*='seller']"]), reviewCount: textOf(root, ["[class*='review']"]), keepCount: textOf(root, ["[class*='keep']"]), rank: index + 1 }, query, index + 1, scope, id, undefined, scope === "CATALOG");
    return item ? [item] : [];
  });
}

function dedupeNaverItems(items: MarketItem[]) {
  return [...new Map(items.map((item) => [`${item.identity.metricScope}:${item.identity.sourceEntityId}:${item.product.sellerName ?? ""}`, item])).values()].slice(0, 1000);
}
