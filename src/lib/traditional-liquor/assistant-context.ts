import "server-only";

import { PostgreSQLTraditionalLiquorRepository } from "@/lib/traditional-liquor/postgresql-repository";

const traditionalLiquorTerms =
  /전통주|막걸리|탁주|약주|청주|과실주|증류주|소주|양조장|주류\s*(?:시장|가격|판매)|traditional\s+(?:liquor|alcohol)|makgeolli|yakju|takju/i;

export function isTraditionalLiquorQuestion(message: string) {
  return traditionalLiquorTerms.test(message);
}

export async function buildTraditionalLiquorAssistantContext(message: string) {
  if (!isTraditionalLiquorQuestion(message)) return null;

  const dataset = await new PostgreSQLTraditionalLiquorRepository().getDataset();
  const productById = new Map(dataset.products.map((product) => [product.id, product]));
  const platformById = new Map(dataset.platforms.map((platform) => [platform.id, platform]));
  const sellerById = new Map(dataset.sellers.map((seller) => [seller.id, seller]));
  const breweryById = new Map(dataset.breweries.map((brewery) => [brewery.id, brewery]));

  const offers = [...dataset.offers]
    .filter((offer) => Number.isFinite(offer.price) && offer.price >= 0)
    .sort((left, right) => left.price - right.price)
    .slice(0, 120)
    .map((offer) => {
      const product = productById.get(offer.productId);
      const brewery = product ? breweryById.get(product.breweryId) : null;
      const platform = platformById.get(offer.platformId);
      const seller = sellerById.get(offer.sellerId);
      return [
        product?.name || offer.listingTitle || "이름 미확인",
        product?.category || product?.subCategory || "분류 미확인",
        product?.region || brewery?.region || "지역 미확인",
        product?.abv ? `${product.abv}%` : "도수 미확인",
        offer.volumeMl ? `${offer.volumeMl}ml` : product?.volumeMl ? `${product.volumeMl}ml` : "용량 미확인",
        `${Math.round(offer.price).toLocaleString("ko-KR")}원`,
        platform?.name || "플랫폼 미확인",
        seller?.name || "판매자 미확인",
        offer.lastCheckedAt ? `확인 ${offer.lastCheckedAt}` : "확인일 미상"
      ].join(" | ");
    });

  const summary = [
    `제품 ${dataset.products.length}개`,
    `가격 제안 ${dataset.offers.length}개`,
    `플랫폼 ${dataset.platforms.length}개`,
    `판매자 ${dataset.sellers.length}개`,
    `양조장 ${dataset.breweries.length}개`
  ].join(" · ");

  const hasRecords = dataset.products.length > 0 || dataset.offers.length > 0;

  return {
    hasRecords,
    text: `WOOHYUKMON 4.0 TRADITIONAL LIQUOR DATABASE CONTEXT
The following read-only records come from K_LINE's server-side Traditional Liquor DB.
Use these records as the primary and default evidence for the user's traditional-liquor question. Do not use external search material when the database answers the question. Distinguish stored price observations from general market facts. Do not invent missing values. Mention the data check time when relevant.
Dataset summary: ${summary}
Price-sorted offer records (lowest first, up to 120):
${offers.length > 0 ? offers.join("\n") : "No active offer records are currently stored."}`
  };
}
