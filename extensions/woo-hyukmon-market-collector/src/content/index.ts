const PLATFORM_COLLECTORS: PlatformCollector[] = [NaverCollector, KakaoGiftCollector];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== WHM_MESSAGES.RUN && message?.type !== WHM_MESSAGES.DEBUG) return;
  const collector = PLATFORM_COLLECTORS.find((candidate) => candidate.supports(location.href));
  if (!collector) { sendResponse({ ok: false, error: "지원되지 않는 페이지입니다." }); return; }
  const query = String(message.query || new URL(location.href).searchParams.get("query") || "전통주").trim();
  void collector.collect(query).then((result) => {
    const collectedAt = new Date().toISOString();
    const metricsCount = result.items.reduce((total, item) => total + item.metrics.length, 0);
    const warnings = [...result.warnings];
    if (collector.code === "NAVER") {
      const purchaseMetricCount = result.items.filter((item) => item.metrics.some((metric) => metric.type === "SOURCE_PURCHASE_COUNT")).length;
      if (purchaseMetricCount < result.items.length) warnings.push(`구매수 Metric은 ${purchaseMetricCount}개 수집 항목에서만 제공됩니다. 나머지는 Catalog 또는 미제공 상품입니다.`);
    }
    const payload: CollectorPayload = {
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
