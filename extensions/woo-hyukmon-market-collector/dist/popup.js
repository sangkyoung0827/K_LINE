globalThis.WHM_PLATFORM_REGISTRY = [{"code":"NAVER","displayName":"네이버","collector":"NAVER_SHOPPING","targetUrlTemplate":"https://search.shopping.naver.com/search/all?query={query}","metrics":[{"type":"PRICE","displayName":"가격","category":"OFFER","availability":"AVAILABLE"},{"type":"SOURCE_PURCHASE_COUNT","displayName":"구매수","category":"SALES","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"REVIEW_COUNT","displayName":"후기수","category":"POPULARITY","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"KEEP_COUNT","displayName":"찜","category":"POPULARITY","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"RATING","displayName":"평점","category":"POPULARITY","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"SEARCH_RANK","displayName":"검색순위","category":"RANK","availability":"AVAILABLE"}]},{"code":"KAKAO_GIFT","displayName":"카카오톡 선물하기","collector":"KAKAO_GIFT","targetUrlTemplate":"https://gift.kakao.com/search/result?query={query}","metrics":[{"type":"PRICE","displayName":"가격","category":"OFFER","availability":"AVAILABLE"},{"type":"WISH_COUNT","displayName":"위시수","category":"POPULARITY","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"REVIEW_COUNT","displayName":"후기수","category":"POPULARITY","availability":"AVAILABLE_WHEN_PUBLIC"},{"type":"SEARCH_RANK","displayName":"노출순위","category":"RANK","availability":"AVAILABLE"},{"type":"SOURCE_PURCHASE_COUNT","displayName":"직접 구매수","category":"SALES","availability":"UNAVAILABLE","note":"현재 공개 데이터에서 확보 불가"}]}];
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

const statusElement = document.querySelector("#page-status");
const resultElement = document.querySelector("#result");
const collectButton = document.querySelector("#collect");
const queryInput = document.querySelector("#query");
let activeTabId;
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    activeTabId = tab?.id;
    const platform = (WHM_PLATFORM_REGISTRY ?? []).find((candidate) => tab?.url?.startsWith(candidate.targetUrlTemplate.split("?")[0]));
    statusElement.textContent = platform ? `${platform.collector} · 지원되는 페이지입니다.` : "지원되는 NAVER_SHOPPING 또는 KAKAO_GIFT 페이지를 여세요.";
    collectButton.disabled = !platform || !activeTabId;
    if (tab?.url)
        queryInput.value = new URL(tab.url).searchParams.get("query") || "전통주";
});
collectButton.addEventListener("click", () => {
    if (!activeTabId)
        return;
    collectButton.disabled = true;
    resultElement.textContent = "공개 페이지 데이터를 수집 중입니다...";
    chrome.tabs.sendMessage(activeTabId, { type: "WOOHYUKMON_DEBUG_COLLECT_CURRENT_PAGE", query: queryInput.value.trim() || "전통주" }, (response) => {
        collectButton.disabled = false;
        resultElement.textContent = chrome.runtime.lastError?.message || JSON.stringify(response, null, 2);
    });
});
