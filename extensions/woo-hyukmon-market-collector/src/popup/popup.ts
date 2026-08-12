const statusElement = document.querySelector<HTMLParagraphElement>("#page-status")!;
const resultElement = document.querySelector<HTMLPreElement>("#result")!;
const collectButton = document.querySelector<HTMLButtonElement>("#collect")!;
const queryInput = document.querySelector<HTMLInputElement>("#query")!;
let activeTabId: number | undefined;

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  activeTabId = tab?.id;
  const platform = (WHM_PLATFORM_REGISTRY ?? []).find((candidate: any) => tab?.url?.startsWith(candidate.targetUrlTemplate.split("?")[0]));
  statusElement.textContent = platform ? `${platform.collector} · 지원되는 페이지입니다.` : "지원되는 NAVER_SHOPPING 또는 KAKAO_GIFT 페이지를 여세요.";
  collectButton.disabled = !platform || !activeTabId;
  if (tab?.url) queryInput.value = new URL(tab.url).searchParams.get("query") || "전통주";
});

collectButton.addEventListener("click", () => {
  if (!activeTabId) return;
  collectButton.disabled = true; resultElement.textContent = "공개 페이지 데이터를 수집 중입니다...";
  chrome.tabs.sendMessage(activeTabId, { type: "WOOHYUKMON_DEBUG_COLLECT_CURRENT_PAGE", query: queryInput.value.trim() || "전통주" }, (response) => {
    collectButton.disabled = false;
    resultElement.textContent = chrome.runtime.lastError?.message || JSON.stringify(response, null, 2);
  });
});
