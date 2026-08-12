globalThis.WHM_PLATFORM_REGISTRY = [{"code":"NAVER","displayName":"네이버","collector":"NAVER_SHOPPING","targetUrlTemplate":"https://search.shopping.naver.com/search/all?query={query}","metrics":[{"type":"PRICE","displayName":"가격","category":"OFFER","availability":"AVAILABLE"},{"type":"SOURCE_PURCHASE_COUNT","displayName":"구매수","category":"SALES","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"REVIEW_COUNT","displayName":"후기수","category":"POPULARITY","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"KEEP_COUNT","displayName":"찜","category":"POPULARITY","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"RATING","displayName":"평점","category":"POPULARITY","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"SEARCH_RANK","displayName":"검색순위","category":"RANK","availability":"AVAILABLE"}]},{"code":"KAKAO_GIFT","displayName":"카카오톡 선물하기","collector":"KAKAO_GIFT","targetUrlTemplate":"https://gift.kakao.com/search/result?query={query}","metrics":[{"type":"PRICE","displayName":"가격","category":"OFFER","availability":"AVAILABLE"},{"type":"WISH_COUNT","displayName":"위시수","category":"POPULARITY","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"REVIEW_COUNT","displayName":"후기수","category":"POPULARITY","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"SEARCH_RANK","displayName":"노출순위","category":"RANK","availability":"AVAILABLE"},{"type":"SOURCE_PURCHASE_COUNT","displayName":"직접 구매수","category":"SALES","availability":"UNAVAILABLE","note":"현재 공개 데이터에서 확보 불가"}]}];
const WHM_MESSAGES = {
    PING: "WOOHYUKMON_COLLECTOR_PING",
    PONG: "WOOHYUKMON_COLLECTOR_PONG",
    START: "WOOHYUKMON_COLLECTOR_START",
    ACK: "WOOHYUKMON_COLLECTOR_ACK",
    UPDATE: "WOOHYUKMON_COLLECTOR_UPDATE",
    RUN: "WOOHYUKMON_RUN_PLATFORM_COLLECTOR",
    DEBUG: "WOOHYUKMON_DEBUG_COLLECT_CURRENT_PAGE"
};

function compactNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return Math.max(0, Math.round(value));
    if (typeof value !== "string")
        return undefined;
    const text = value.replace(/,/g, "").trim();
    const match = text.match(/([\d.]+)\s*(만|천)?/);
    if (!match)
        return undefined;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount))
        return undefined;
    return Math.max(0, Math.round(amount * (match[2] === "만" ? 10000 : match[2] === "천" ? 1000 : 1)));
}
function textOf(root, selectors) {
    for (const selector of selectors) {
        const value = root.querySelector(selector)?.textContent?.trim();
        if (value)
            return value;
    }
    return "";
}
function absoluteUrl(value) {
    if (!value)
        return location.href;
    try {
        return new URL(value, location.href).href;
    }
    catch {
        return location.href;
    }
}

function metric(type, value, scope) {
    const parsed = type === "RATING" ? decimalNumber(value) : compactNumber(value);
    return parsed === undefined ? null : { type, value: parsed, scope };
}
function decimalNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    const match = typeof value === "string" ? value.replace(/,/g, "").match(/[\d.]+/) : null;
    const parsed = match ? Number(match[0]) : NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
}
function uniqueMetrics(metrics) {
    return metrics.filter((item) => Boolean(item));
}
function volumeFromName(name) {
    const match = name.match(/(\d+(?:\.\d+)?)\s*(ml|mL|ML|ℓ|L|리터)/);
    if (!match)
        return undefined;
    const amount = Number(match[1]);
    return /^(l|ℓ|리터)$/i.test(match[2]) ? Math.round(amount * 1000) : Math.round(amount);
}
function detectedAccessBlock() {
    const content = document.body?.innerText?.slice(0, 5000) ?? "";
    return /captcha|자동입력 방지|비정상적인 접근|접근이 제한|로그인이 필요|요청이 너무 많/i.test(content);
}

const NaverCollector = {
    code: "NAVER",
    supports(url) { return new URL(url).hostname === "search.shopping.naver.com"; },
    async collect(query) {
        if (detectedAccessBlock())
            throw new Error("네이버가 접근 제한 또는 확인 화면을 표시했습니다. 우회하지 않고 수집을 중지했습니다.");
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
function collectNaverNextData(query) {
    const script = document.querySelector("script#__NEXT_DATA__");
    if (!script?.textContent)
        return [];
    try {
        const root = JSON.parse(script.textContent);
        const candidates = [];
        walkNaverJson(root, candidates, new WeakSet());
        return candidates.flatMap((candidate, index) => naverCandidateItems(candidate, query, index + 1));
    }
    catch {
        return [];
    }
}
function walkNaverJson(value, output, seen) {
    if (!value || typeof value !== "object" || seen.has(value))
        return;
    seen.add(value);
    if (!Array.isArray(value)) {
        const item = value;
        const name = item.productName ?? item.productTitle ?? item.title ?? item.name;
        const id = item.id ?? item.productId ?? item.catalogId ?? item.nvMid;
        if (name && id && (item.price !== undefined || item.lowPrice !== undefined || item.mallProductUrl || item.productUrl))
            output.push(item);
    }
    Object.values(value).forEach((child) => walkNaverJson(child, output, seen));
}
function naverCandidateItems(candidate, query, rank) {
    const name = String(candidate.productName ?? candidate.productTitle ?? candidate.title ?? candidate.name ?? "").trim();
    const catalogId = String(candidate.catalogId ?? candidate.nvMid ?? candidate.productId ?? candidate.id ?? "").trim();
    if (!name || !catalogId)
        return [];
    const lowMalls = Array.isArray(candidate.lowMallList) ? candidate.lowMallList : [];
    if (lowMalls.length) {
        const catalog = makeNaverItem(candidate, query, rank, "CATALOG", catalogId, undefined, true);
        const offers = lowMalls.flatMap((mall, index) => {
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
function makeNaverItem(candidate, query, rank, scope, sourceId, sellerOverride, catalog = false) {
    const productName = String(candidate.productName ?? candidate.productTitle ?? candidate.title ?? candidate.name ?? "").replace(/<[^>]+>/g, "").trim();
    const price = compactNumber(candidate.price ?? candidate.lowPrice ?? candidate.salePrice);
    if (!productName || price === undefined)
        return null;
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
function collectNaverDom(query) {
    const roots = [...document.querySelectorAll("[class*='product_item'], [class*='productItem'], li[class*='product']")];
    return roots.flatMap((root, index) => {
        const link = root.querySelector("a[href]");
        const name = textOf(root, ["[class*='product_title']", "[class*='productName']", "a[title]"]) || link?.title || "";
        const price = compactNumber(textOf(root, ["[class*='price_num']", "[class*='price']"]));
        if (!name || price === undefined)
            return [];
        const url = absoluteUrl(link?.href);
        const id = new URL(url).searchParams.get("nvMid") || root.dataset.nvMid || `dom:${index}:${name}`;
        const scope = /가격비교/.test(root.innerText) ? "CATALOG" : "OFFER";
        const item = makeNaverItem({ productName: name, price, productUrl: url, mallName: textOf(root, ["[class*='mall']", "[class*='seller']"]), reviewCount: textOf(root, ["[class*='review']"]), keepCount: textOf(root, ["[class*='keep']"]), rank: index + 1 }, query, index + 1, scope, id, undefined, scope === "CATALOG");
        return item ? [item] : [];
    });
}
function dedupeNaverItems(items) {
    return [...new Map(items.map((item) => [`${item.identity.metricScope}:${item.identity.sourceEntityId}:${item.product.sellerName ?? ""}`, item])).values()].slice(0, 1000);
}

const KakaoGiftCollector = {
    code: "KAKAO_GIFT",
    supports(url) { return new URL(url).hostname === "gift.kakao.com"; },
    async collect(query) {
        if (detectedAccessBlock())
            throw new Error("카카오가 접근 제한 또는 확인 화면을 표시했습니다. 우회하지 않고 수집을 중지했습니다.");
        const items = new Map();
        let unchanged = 0;
        let scannedCount = 0;
        for (let round = 0; round < 30 && items.size < 1000 && unchanged < 3; round += 1) {
            const current = collectKakaoDom(query);
            scannedCount = Math.max(scannedCount, current.scannedCount);
            const before = items.size;
            current.items.forEach((item) => items.set(item.identity.sourceEntityId, item));
            unchanged = items.size === before ? unchanged + 1 : 0;
            if (unchanged >= 3)
                break;
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
            await new Promise((resolve) => setTimeout(resolve, 1100));
            if (detectedAccessBlock())
                throw new Error("카카오가 수집 도중 접근 제한 화면을 표시했습니다. 우회하지 않고 중지했습니다.");
        }
        const totalText = document.body.innerText.match(/총\s*([\d,]+)\s*개/)?.[1];
        const total = compactNumber(totalText);
        const warnings = total && total > items.size ? [`현재 세션에서 ${items.size}개 상품을 수집했습니다. 검색 결과 전체 ${total}개와 일치하지 않을 수 있습니다.`] : [];
        return { items: [...items.values()], scannedCount, skippedItems: Math.max(0, scannedCount - items.size), warnings };
    }
};
function collectKakaoDom(query) {
    const roots = [...document.querySelectorAll("li[class*='item'], [class*='product_item'], [class*='item_product'], article")];
    const items = [];
    roots.forEach((root, index) => {
        const link = root.querySelector("a[href*='/product/'], a[href*='/products/'], a[href]");
        const productName = textOf(root, ["[class*='name_product']", "[class*='product_name']", "[class*='tit_product']", "strong"]);
        const price = compactNumber(textOf(root, ["[class*='price']", "[class*='amount']"]));
        if (!link || !productName || price === undefined)
            return;
        const listingUrl = absoluteUrl(link.href);
        const match = listingUrl.match(/\/(?:product|products)\/(\d+)/) ?? listingUrl.match(/[?&](?:productId|id)=([^&]+)/);
        const sourceEntityId = match?.[1] ?? root.dataset.productId ?? `dom:${index}:${productName}`;
        const scope = "OFFER";
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

const PLATFORM_COLLECTORS = [NaverCollector, KakaoGiftCollector];
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== WHM_MESSAGES.RUN && message?.type !== WHM_MESSAGES.DEBUG)
        return;
    const collector = PLATFORM_COLLECTORS.find((candidate) => candidate.supports(location.href));
    if (!collector) {
        sendResponse({ ok: false, error: "지원되지 않는 페이지입니다." });
        return;
    }
    const query = String(message.query || new URL(location.href).searchParams.get("query") || "전통주").trim();
    void collector.collect(query).then((result) => {
        const collectedAt = new Date().toISOString();
        const metricsCount = result.items.reduce((total, item) => total + item.metrics.length, 0);
        const warnings = [...result.warnings];
        if (collector.code === "NAVER") {
            const purchaseMetricCount = result.items.filter((item) => item.metrics.some((metric) => metric.type === "SOURCE_PURCHASE_COUNT")).length;
            if (purchaseMetricCount < result.items.length)
                warnings.push(`구매수 Metric은 ${purchaseMetricCount}개 수집 항목에서만 제공됩니다. 나머지는 Catalog 또는 미제공 상품입니다.`);
        }
        const payload = {
            version: "1",
            platformCode: collector.code,
            query,
            collectedAt,
            items: result.items,
            diagnostics: {
                collectorVersion: `${collector.code}_V1`, platform: collector.code, pageUrl: location.href, query,
                scannedCount: result.scannedCount, collectedItems: result.items.length, skippedItems: result.skippedItems,
                offersCount: result.items.filter((item) => item.offer).length, metricsCount,
                warnings, errors: []
            }
        };
        sendResponse({ ok: true, payload });
    }).catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "수집에 실패했습니다." }));
    return true;
});
