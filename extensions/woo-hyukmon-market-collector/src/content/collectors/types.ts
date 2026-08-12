type PlatformCollector = {
  code: "NAVER" | "KAKAO_GIFT";
  supports(url: string): boolean;
  collect(query: string): Promise<{ items: MarketItem[]; scannedCount: number; skippedItems: number; warnings: string[] }>;
};

function metric(type: string, value: unknown, scope: MetricScope): CollectorMetric | null {
  const parsed = type === "RATING" ? decimalNumber(value) : compactNumber(value);
  return parsed === undefined ? null : { type, value: parsed, scope };
}

function decimalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = typeof value === "string" ? value.replace(/,/g, "").match(/[\d.]+/) : null;
  const parsed = match ? Number(match[0]) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function uniqueMetrics(metrics: Array<CollectorMetric | null>) {
  return metrics.filter((item): item is CollectorMetric => Boolean(item));
}

function volumeFromName(name: string) {
  const match = name.match(/(\d+(?:\.\d+)?)\s*(ml|mL|ML|ℓ|L|리터)/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  return /^(l|ℓ|리터)$/i.test(match[2]) ? Math.round(amount * 1000) : Math.round(amount);
}

function detectedAccessBlock() {
  const content = document.body?.innerText?.slice(0, 5000) ?? "";
  return /captcha|자동입력 방지|비정상적인 접근|접근이 제한|로그인이 필요|요청이 너무 많/i.test(content);
}
