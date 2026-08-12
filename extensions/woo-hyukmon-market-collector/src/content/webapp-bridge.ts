window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin || event.data?.source !== "KLINE_WEB") return;
  if (event.data.type !== WHM_MESSAGES.PING && event.data.type !== WHM_MESSAGES.START) return;
  chrome.runtime.sendMessage(event.data, (response) => {
    window.postMessage({ source: "WOOHYUKMON_EXTENSION", requestId: event.data.requestId, ...(response ?? { ok: false, error: chrome.runtime.lastError?.message ?? "Extension response unavailable." }) }, location.origin);
  });
});
