import type {
  TraditionalLiquorAnalyticsFilters,
  TraditionalLiquorAnalyticsResponse,
  TraditionalLiquorAnalyticsView,
  TraditionalLiquorQueryIntent
} from "@/lib/traditional-liquor/types";

const exactOpenDatabaseCommands = new Set([
  "전통주 DB열어",
  "전통주 데이터베이스 열어"
]);

export function detectTraditionalLiquorIntent(message: string): TraditionalLiquorQueryIntent | null {
  const normalized = message.trim();
  if (!normalized) return null;
  if (exactOpenDatabaseCommands.has(normalized)) {
    return "OPEN_TRADITIONAL_LIQUOR_DATABASE";
  }
  return null;
}

const analyticsPersistencePrefix = "__KLINE_TRADITIONAL_LIQUOR_ANALYTICS__";

export function detectTraditionalLiquorAnalytics(
  message: string,
  activeState?: TraditionalLiquorAnalyticsResponse | null
): TraditionalLiquorAnalyticsResponse | null {
  const normalized = normalizeAnalyticsMessage(message);
  if (!normalized || exactOpenDatabaseCommands.has(message.trim())) return null;

  const hasDomain = /전통주|막걸리|탁주|약주|traditional liquor|makgeolli/.test(normalized);
  const hasDatabaseNoun = /(?:db|database|데이터베이스|데이터|시장 데이터)/.test(normalized);
  const followUp = Boolean(activeState) && hasAnalyticsControl(normalized);
  if (!hasDomain && !followUp) return null;

  const filters = parseAnalyticsFilters(normalized, followUp ? activeState?.filters : undefined);
  const requestedView = detectAnalyticsView(normalized, hasDatabaseNoun);
  const view = requestedView ?? (followUp ? activeState?.view : null);
  if (!view) return null;

  if (view === "SALES") {
    filters.platformCode ??= "NAVER";
    filters.metricType ??= filters.platformCode === "KAKAO_GIFT" ? "WISH_COUNT" : "SOURCE_PURCHASE_COUNT";
    filters.period ??= "LATEST";
  }
  if (view === "PRICE") filters.sort ??= "LOWEST";

  return {
    type: "TRADITIONAL_LIQUOR_ANALYTICS",
    view,
    filters: Object.keys(filters).length ? filters : undefined
  };
}

export function serializeTraditionalLiquorAnalytics(response: TraditionalLiquorAnalyticsResponse) {
  return `${analyticsPersistencePrefix}${JSON.stringify(response)}`;
}

export function parseTraditionalLiquorAnalytics(value: string) {
  if (!value.startsWith(analyticsPersistencePrefix)) return null;
  try {
    const parsed = JSON.parse(value.slice(analyticsPersistencePrefix.length)) as TraditionalLiquorAnalyticsResponse;
    if (parsed.type !== "TRADITIONAL_LIQUOR_ANALYTICS" || !isAnalyticsView(parsed.view)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function describeTraditionalLiquorAnalytics(response: TraditionalLiquorAnalyticsResponse) {
  const labels: Record<TraditionalLiquorAnalyticsView, string> = {
    OVERVIEW: "전체", PRODUCT: "제품별", PLATFORM: "플랫폼별", SELLER: "업체별", PRICE: "가격별", SALES: "판매량별"
  };
  return `전통주 DATABASE · ${labels[response.view]}`;
}

function normalizeAnalyticsMessage(message: string) {
  return message
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[?!.,~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectAnalyticsView(message: string, hasDatabaseNoun: boolean): TraditionalLiquorAnalyticsView | null {
  if (/판매량|구매수|많이 팔|판매 순위|판매량 증가|전체 추이/.test(message)) return "SALES";
  if (/가격|최저가|최고가|싼 순|비싼 순|만원|원 이하|원 이상|원에서/.test(message)) return "PRICE";
  if (/플랫폼별|판매 플랫폼|platform/.test(message)) return "PLATFORM";
  if (/업체별|판매업체|업체 기준|seller/.test(message)) return "SELLER";
  if (/제품별|제품 목록|제품 기준|product/.test(message)) return "PRODUCT";
  if (hasDatabaseNoun && /보여|열어|현황|전체|한번 보|볼게|조회/.test(message)) return "OVERVIEW";
  return null;
}

function hasAnalyticsControl(message: string) {
  return /네이버|카카오|가격|최저가|최고가|싼 순|비싼 순|만원|원 이하|원 이상|최근 7일|7일|30일|전체 추이|제품별|플랫폼별|업체별|판매량별/.test(message);
}

function parseAnalyticsFilters(message: string, previous?: TraditionalLiquorAnalyticsFilters) {
  const filters: TraditionalLiquorAnalyticsFilters = { ...(previous ?? {}) };
  if (/네이버|naver/.test(message)) filters.platformCode = "NAVER";
  if (/카카오톡?\s*선물하기|카카오\s*선물|kakao(?:_gift)?|gift\.kakao/.test(message)) filters.platformCode = "KAKAO_GIFT";

  const range = message.match(/([\d,.]+)\s*만?\s*원?\s*(?:에서|부터|~|-)\s*([\d,.]+)\s*만?\s*원?\s*(?:사이|까지)?/);
  if (range) {
    filters.minPrice = parseKoreanPrice(range[1], range[0].includes("만"));
    filters.maxPrice = parseKoreanPrice(range[2], range[0].includes("만"));
  } else {
    const maximum = message.match(/([\d,.]+)\s*(만)?\s*원?\s*이하/);
    const minimum = message.match(/([\d,.]+)\s*(만)?\s*원?\s*이상/);
    if (maximum) filters.maxPrice = parseKoreanPrice(maximum[1], Boolean(maximum[2]));
    if (minimum) filters.minPrice = parseKoreanPrice(minimum[1], Boolean(minimum[2]));
  }

  if (/싼 순|최저가/.test(message)) filters.sort = "LOWEST";
  if (/비싼 순|최고가/.test(message)) filters.sort = "HIGHEST";
  if (/100\s*ml/.test(message)) filters.sort = "PER_100ML";
  if (/최근\s*7일|7일 증가/.test(message)) filters.period = "7D";
  if (/최근\s*30일|30일 증가/.test(message)) filters.period = "30D";
  if (/전체 추이|변화 추이/.test(message)) filters.period = "HISTORY";
  return filters;
}

function parseKoreanPrice(value: string, inTenThousands: boolean) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * (inTenThousands ? 10_000 : 1)) : undefined;
}

function isAnalyticsView(value: unknown): value is TraditionalLiquorAnalyticsView {
  return value === "OVERVIEW" || value === "PRODUCT" || value === "PLATFORM" || value === "SELLER" || value === "PRICE" || value === "SALES";
}
