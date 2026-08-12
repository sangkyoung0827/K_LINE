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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === WHM_MESSAGES.PING) {
        sendResponse({ ok: true, type: WHM_MESSAGES.PONG, version: "1.0.0" });
        return;
    }
    if (message?.type !== WHM_MESSAGES.START)
        return;
    const job = message.job;
    if (!job?.id || !job?.collectorToken || !job?.targetUrl || !job?.apiOrigin) {
        sendResponse({ ok: false, error: "Collector Job 정보가 올바르지 않습니다." });
        return;
    }
    sendResponse({ ok: true, type: WHM_MESSAGES.ACK });
    void queueCollectorJob(job);
});
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status !== "complete")
        return;
    void takeStoredCollectorJob(tabId, tab.url).then((job) => { if (job)
        void runLoadedCollectorJob(tabId, job); });
});
chrome.tabs.onRemoved.addListener((tabId) => {
    void storedCollectorJob(tabId).then((job) => {
        if (!job)
            return;
        chrome.storage.local.remove(storageKey(tabId));
        void updateCollectorJob(job, "FAILED", "사용자가 수집 탭을 닫았습니다.");
    });
});
async function queueCollectorJob(job) {
    try {
        await updateCollectorJob(job, "DISPATCHED");
        const tab = await createCollectorTab();
        if (!tab.id)
            throw new Error("수집 탭을 열지 못했습니다.");
        await saveCollectorJob(tab.id, job);
        await updateCollectorTab(tab.id, job.targetUrl);
    }
    catch (error) {
        await updateCollectorJob(job, "FAILED", error instanceof Error ? error.message : "Collector failed.").catch(() => undefined);
    }
}
async function runLoadedCollectorJob(tabId, job) {
    try {
        await updateCollectorJob(job, "RUNNING");
        const response = await sendToCollectorTabWithRetry(tabId, { type: WHM_MESSAGES.RUN, query: job.query, platformCode: job.platformCode });
        if (!response?.ok || !response.payload)
            throw new Error(response?.error || "페이지 Collector가 결과를 반환하지 않았습니다.");
        const upload = await fetch(`${job.apiOrigin}/api/v4/traditional-liquor/collector/jobs/${encodeURIComponent(job.id)}/result`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${job.collectorToken}` },
            body: JSON.stringify(response.payload)
        });
        if (!upload.ok)
            throw new Error((await upload.json().catch(() => ({}))).error || "Collector 결과 업로드에 실패했습니다.");
    }
    catch (error) {
        await updateCollectorJob(job, "FAILED", error instanceof Error ? error.message : "Collector failed.").catch(() => undefined);
    }
    finally {
        chrome.storage.local.remove(storageKey(tabId));
    }
}
async function updateCollectorJob(job, status, errorMessage) {
    const response = await fetch(`${job.apiOrigin}/api/v4/traditional-liquor/collector/jobs/${encodeURIComponent(job.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${job.collectorToken}` },
        body: JSON.stringify({ status, errorMessage })
    });
    if (!response.ok && status !== "FAILED")
        throw new Error("Collector Job 상태 갱신에 실패했습니다.");
}
function createCollectorTab() {
    return new Promise((resolve) => chrome.tabs.create({ active: true }, resolve));
}
function updateCollectorTab(tabId, url) {
    return new Promise((resolve, reject) => chrome.tabs.update(tabId, { url }, () => {
        if (chrome.runtime.lastError)
            reject(new Error(chrome.runtime.lastError.message || "수집 페이지를 열지 못했습니다."));
        else
            resolve();
    }));
}
function sendToCollectorTab(tabId, message) {
    return new Promise((resolve, reject) => chrome.tabs.sendMessage(tabId, message, (response) => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message || "Content script unavailable.")) : resolve(response)));
}
async function sendToCollectorTabWithRetry(tabId, message) {
    let lastError;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            return await sendToCollectorTab(tabId, message);
        }
        catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }
    throw lastError instanceof Error ? lastError : new Error("Content script unavailable.");
}
function storageKey(tabId) { return `wooHyukmonCollectorTab:${tabId}`; }
function saveCollectorJob(tabId, job) { return new Promise((resolve) => chrome.storage.local.set({ [storageKey(tabId)]: job }, resolve)); }
function storedCollectorJob(tabId) { return new Promise((resolve) => chrome.storage.local.get(storageKey(tabId), (items) => resolve(items[storageKey(tabId)] ?? null))); }
async function takeStoredCollectorJob(tabId, pageUrl) {
    const job = await storedCollectorJob(tabId);
    if (!job || !sameCollectorHost(pageUrl, job.targetUrl))
        return null;
    await new Promise((resolve) => chrome.storage.local.remove(storageKey(tabId), resolve));
    return job;
}
function sameCollectorHost(pageUrl, targetUrl) {
    try {
        return typeof pageUrl === "string" && typeof targetUrl === "string" && new URL(pageUrl).hostname === new URL(targetUrl).hostname;
    }
    catch {
        return false;
    }
}
