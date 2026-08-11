import type { TraditionalLiquorDataset } from "@/lib/traditional-liquor/types";

// Development-only sample records. They are illustrative and are never presented as live market data.
export const traditionalLiquorMockData: TraditionalLiquorDataset = {
  source: "mock",
  breweries: [
    { id: "brewery-andong", name: "안동명주 양조장", region: "경상북도 안동", description: "안동 지역의 증류식 소주 문화를 잇는 샘플 양조장 정보입니다." },
    { id: "brewery-boksoon", name: "복순도가", region: "울산광역시 울주", description: "쌀과 누룩의 발효 특성을 보여주는 손막걸리 생산자 예시입니다." },
    { id: "brewery-moonbae", name: "문배주양조원", region: "경기도 김포", description: "문배 향을 특징으로 하는 증류주 생산자 예시입니다." }
  ],
  platforms: [
    { id: "platform-naver", name: "NAVER", code: "NAVER" },
    { id: "platform-kakao", name: "KAKAO GIFT", code: "KAKAO_GIFT" },
    { id: "platform-sooldamhwa", name: "술담화", code: "SOOLDAMHWA" }
  ],
  sellers: [
    { id: "seller-woorisul", name: "우리술상회" },
    { id: "seller-hanok", name: "한옥마켓" },
    { id: "seller-onul", name: "오늘의전통주" },
    { id: "seller-gift", name: "선물담다" }
  ],
  products: [
    { id: "product-andong", name: "안동소주", canonicalName: "안동소주", breweryId: "brewery-andong", region: "경상북도 안동", category: "증류주", subCategory: "증류식 소주", abv: 45, volumeMl: 375, description: "안동의 증류 전통을 보여주는 고도수 소주 샘플입니다." },
    { id: "product-boksoon", name: "복순도가 손막걸리", canonicalName: "복순도가손막걸리", breweryId: "brewery-boksoon", region: "울산광역시 울주", category: "탁주", subCategory: "막걸리", abv: 6.5, volumeMl: 935, description: "탄산감과 발효 풍미를 지닌 손막걸리 샘플입니다." },
    { id: "product-moonbae", name: "문배주", canonicalName: "문배주", breweryId: "brewery-moonbae", region: "경기도 김포", category: "증류주", subCategory: "전통 증류주", abv: 40, volumeMl: 375, description: "문배를 닮은 향을 특징으로 하는 증류주 샘플입니다." }
  ],
  offers: [
    { id: "offer-1", productId: "product-andong", platformId: "platform-naver", sellerId: "seller-woorisul", listingTitle: "안동소주 375ml 단품", price: 19000, originalPrice: 21000, volumeMl: 375, quantity: 1, shippingFee: 3000, url: null, lastCheckedAt: "2026-08-01T09:00:00+09:00" },
    { id: "offer-2", productId: "product-andong", platformId: "platform-naver", sellerId: "seller-hanok", listingTitle: "안동소주 375ml 2병", price: 36000, originalPrice: null, volumeMl: 375, quantity: 2, shippingFee: 0, url: null, lastCheckedAt: "2026-08-01T09:00:00+09:00" },
    { id: "offer-3", productId: "product-andong", platformId: "platform-kakao", sellerId: "seller-gift", listingTitle: "안동소주 선물세트", price: 39000, originalPrice: 42000, volumeMl: 375, quantity: 2, shippingFee: 0, url: null, lastCheckedAt: "2026-08-01T09:00:00+09:00" },
    { id: "offer-4", productId: "product-boksoon", platformId: "platform-naver", sellerId: "seller-onul", listingTitle: "복순도가 손막걸리", price: 12000, originalPrice: null, volumeMl: 935, quantity: 1, shippingFee: 3000, url: null, lastCheckedAt: "2026-08-01T09:00:00+09:00" },
    { id: "offer-5", productId: "product-boksoon", platformId: "platform-sooldamhwa", sellerId: "seller-woorisul", listingTitle: "복순도가 손막걸리 2병", price: 23500, originalPrice: 25000, volumeMl: 935, quantity: 2, shippingFee: 0, url: null, lastCheckedAt: "2026-08-01T09:00:00+09:00" },
    { id: "offer-6", productId: "product-moonbae", platformId: "platform-naver", sellerId: "seller-woorisul", listingTitle: "문배주 375ml", price: 29000, originalPrice: null, volumeMl: 375, quantity: 1, shippingFee: 0, url: null, lastCheckedAt: "2026-08-01T09:00:00+09:00" },
    { id: "offer-7", productId: "product-moonbae", platformId: "platform-kakao", sellerId: "seller-gift", listingTitle: "문배주 전통 선물 포장", price: 32000, originalPrice: 35000, volumeMl: 375, quantity: 1, shippingFee: 0, url: null, lastCheckedAt: "2026-08-01T09:00:00+09:00" }
  ]
};

