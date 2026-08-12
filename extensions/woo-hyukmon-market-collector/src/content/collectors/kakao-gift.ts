const KakaoGiftCollector: PlatformCollector = {
  code: "KAKAO_GIFT",
  supports(url) { return new URL(url).hostname === "gift.kakao.com"; },
  async collect(query) {
    if (detectedAccessBlock()) throw new Error("카카오가 접근 제한 또는 확인 화면을 표시했습니다. 우회하지 않고 수집을 중지했습니다.");
    const items = new Map<string, MarketItem>();
    let unchanged = 0;
    let scannedCount = 0;
    for (let round = 0; round < 30 && items.size < 1000 && unchanged < 3; round += 1) {
      const current = collectKakaoDom(query);
      scannedCount = Math.max(scannedCount, current.scannedCount);
      const before = items.size;
      current.items.forEach((item) => items.set(item.identity.sourceEntityId, item));
      unchanged = items.size === before ? unchanged + 1 : 0;
      if (unchanged >= 3) break;
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      await new Promise((resolve) => setTimeout(resolve, 1100));
      if (detectedAccessBlock()) throw new Error("카카오가 수집 도중 접근 제한 화면을 표시했습니다. 우회하지 않고 중지했습니다.");
    }
    const totalText = document.body.innerText.match(/총\s*([\d,]+)\s*개/)?.[1];
    const total = compactNumber(totalText);
    const warnings = total && total > items.size ? [`현재 세션에서 ${items.size}개 상품을 수집했습니다. 검색 결과 전체 ${total}개와 일치하지 않을 수 있습니다.`] : [];
    return { items: [...items.values()], scannedCount, skippedItems: Math.max(0, scannedCount - items.size), warnings };
  }
};

function collectKakaoDom(query: string) {
  const roots = [...document.querySelectorAll<HTMLElement>("li[class*='item'], [class*='product_item'], [class*='item_product'], article")];
  const items: MarketItem[] = [];
  roots.forEach((root, index) => {
    const link = root.querySelector<HTMLAnchorElement>("a[href*='/product/'], a[href*='/products/'], a[href]");
    const productName = textOf(root, ["[class*='name_product']", "[class*='product_name']", "[class*='tit_product']", "strong"]);
    const price = compactNumber(textOf(root, ["[class*='price']", "[class*='amount']"]));
    if (!link || !productName || price === undefined) return;
    const listingUrl = absoluteUrl(link.href);
    const match = listingUrl.match(/\/(?:product|products)\/(\d+)/) ?? listingUrl.match(/[?&](?:productId|id)=([^&]+)/);
    const sourceEntityId = match?.[1] ?? root.dataset.productId ?? `dom:${index}:${productName}`;
    const scope: MetricScope = "OFFER";
    items.push({
      identity: { externalOfferId: sourceEntityId, sourceEntityId, metricScope: scope },
      product: { productName, brandName: textOf(root, ["[class*='brand']", "[class*='txt_brand']"]), sellerName: textOf(root, ["[class*='brand']", "[class*='txt_brand']"]) || "카카오톡 선물하기", listingUrl },
      offer: { price, benefitPrice: compactNumber(textOf(root, ["[class*='benefit']", "[class*='sale_price']"])), originalPrice: compactNumber(textOf(root, ["[class*='original']", "del"])), volumeMl: volumeFromName(productName), quantity: 1 },
      metrics: uniqueMetrics([
        metric("WISH_COUNT", textOf(root, ["[class*='wish']", "[class*='like']"]), scope),
        metric("REVIEW_COUNT", textOf(root, ["[class*='review']"]), scope),
        metric("SEARCH_RANK", index + 1, scope)
      ]),
      provenance: { platformCode: "KAKAO_GIFT", query, sourceUrl: location.href, collectedAt: new Date().toISOString(), collectorVersion: "KAKAO_GIFT_V1" }
    });
  });
  return { items, scannedCount: roots.length };
}
