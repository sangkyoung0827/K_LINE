import type { Metadata } from "next";
import { GoodsCard } from "@/components/GoodsCard";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { goods } from "@/data/goods";
import { absoluteUrl, seoKeywords, siteConfig } from "@/lib/seo";

const goodsPageTitle = "K_LINE Goods | Korean Heritage Goods & K-Culture Products";
const goodsPageDescription =
  "Explore K_LINE Goods, a Korean heritage goods collection featuring Hanji mood lamps, Dancheong mugs, Najeonchilgi plates, Korean native dog keyrings, Arrow Pen, and other K-culture gift ideas.";

export const metadata: Metadata = {
  title: {
    absolute: goodsPageTitle
  },
  description: goodsPageDescription,
  keywords: [
    ...seoKeywords,
    "K_LINE Goods",
    "K-Culture Goods",
    "Korean heritage goods",
    "Korean culture gift",
    "Korean traditional design",
    "Korean lifestyle goods",
    "Hanji mood lamp",
    "Dancheong Four Gracious Plants Object",
    "Dancheong mug",
    "Najeonchilgi plate",
    "Korean native dog keyring",
    "Dangun myth mug set",
    "Arrow Pen",
    "K_LINE",
    "케이라인",
    "한국문화 굿즈",
    "전통문화 굿즈",
    "한지 무드등",
    "단청 오브제",
    "단청 머그",
    "단군신화 머그 세트",
    "나전칠기 접시",
    "한국 토종견 키링",
    "한지 은행잎 부채",
    "김홍도 담요",
    "한국 전통 활쏘기 굿즈"
  ],
  alternates: {
    canonical: absoluteUrl("/goods")
  },
  openGraph: {
    title: goodsPageTitle,
    description: goodsPageDescription,
    url: absoluteUrl("/goods"),
    siteName: siteConfig.name,
    images: [
      {
        url: "/images/goods-hero-clean.jpg",
        width: 780,
        height: 600,
        alt: "K_LINE Goods Korean heritage lifestyle goods"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: goodsPageTitle,
    description: goodsPageDescription,
    images: ["/images/goods-hero-clean.jpg"]
  },
  robots: {
    index: true,
    follow: true
  }
};

const goodsSeoSections = [
  {
    name: "Hanji Mood Lamp",
    koreanName: "한지 무드등",
    description:
      "The Hanji Mood Lamp is a warm LED mood lamp using traditional Korean Hanji paper, Korean calligraphy, and a modern 3D-printed frame. It turns Korean writing and paper texture into a contemporary lifestyle object for desks, rooms, exhibitions, and Korean culture gifts.",
    koreanDescription:
      "한지 무드등은 전통 한지의 질감과 한국 서예의 선을 따뜻한 조명으로 보여주는 전통문화 굿즈입니다. 현대적인 오브제로 일상 공간에서 한국문화 굿즈의 분위기를 전합니다.",
    tags: ["Hanji", "Korean calligraphy", "한지 무드등", "Korean lifestyle goods"]
  },
  {
    name: "Dancheong Four Gracious Plants Object",
    koreanName: "단청 사군자 오브제",
    description:
      "This decorative Hanji light object uses a Dancheong-inspired frame with four side panels featuring plum blossom, orchid, chrysanthemum, and bamboo in calligraphy-watercolor style. It connects Korean architectural color, Hanji texture, and traditional literati painting in one refined K-culture object.",
    koreanDescription:
      "단청 사군자 오브제는 매화, 난초, 국화, 대나무를 서예 수묵화 감성으로 담은 한지 조명 오브제입니다. 단청 오브제의 색감과 한지의 질감이 한국 전통 디자인을 자연스럽게 보여줍니다.",
    tags: ["Dancheong", "Four Gracious Plants", "단청 오브제", "Hanji"]
  },
  {
    name: "Dancheong Mug Collection",
    koreanName: "단청 머그 컬렉션",
    description:
      "The Dancheong Mug Collection is a premium mug line inspired by Korean Dancheong patterns from palaces and temples. These Dancheong mugs are designed for tea culture, daily use, gifting, and collecting as accessible Korean heritage goods.",
    koreanDescription:
      "단청 머그 컬렉션은 궁궐과 사찰의 단청 문양에서 영감을 받은 단청 머그 라인입니다. 차 문화, 선물, 수집용으로 활용하기 좋은 한국문화 굿즈입니다.",
    tags: ["Dancheong mug", "Korean culture gift", "단청 머그", "K-Culture Goods"]
  },
  {
    name: "Dangun Myth Storytelling Mug Set",
    koreanName: "단군신화 스토리텔링 머그 세트",
    description:
      "The Dangun Myth Storytelling Mug Set presents symbolic characters from Korea's founding story, including the bear, tiger, Dangun, and the heavenly realm. The gift set concept can include mugwort and garlic-inspired teaspoons, making it a Korean culture gift with a clear narrative.",
    koreanDescription:
      "단군신화 머그 세트는 곰, 호랑이, 단군, 천상 세계를 상징적으로 담은 스토리텔링 굿즈입니다. 쑥과 마늘에서 착안한 티스푼을 함께 구성할 수 있는 전통문화 선물 콘셉트입니다.",
    tags: ["Dangun myth mug set", "Korean heritage goods", "단군신화 머그 세트", "Korean culture gift"]
  },
  {
    name: "Najeonchilgi Plate Collection",
    koreanName: "나전칠기 접시 컬렉션",
    description:
      "The Najeonchilgi Plate Collection is a contemporary plate line inspired by Korean mother-of-pearl lacquerware. Motifs such as cranes, peonies, clouds, and geometric borders express elegance, craft memory, and Korean traditional design.",
    koreanDescription:
      "나전칠기 접시 컬렉션은 나전칠기의 빛과 공예적 아름다움을 현대적인 접시로 재해석합니다. 학, 모란, 구름, 기하학 문양을 통해 세련된 한국 전통 디자인을 보여줍니다.",
    tags: ["Najeonchilgi", "Najeonchilgi plate", "나전칠기 접시", "Korean traditional design"]
  },
  {
    name: "Korean Native Dog Keyring Series",
    koreanName: "한국 토종견 키링 시리즈",
    description:
      "The Korean Native Dog Keyring Series is a cute acrylic keyring collection featuring Korean native dogs such as Jindo, Sapsali, Donggyeongi, and Pungsan. It is designed as an accessible K-culture goods line for bags, keys, pouches, campus souvenirs, and small gifts.",
    koreanDescription:
      "한국 토종견 키링 시리즈는 진돗개, 삽살개, 동경이, 풍산개를 귀여운 아크릴 키링으로 표현한 한국문화 굿즈입니다. 가방, 열쇠, 파우치에 달기 좋은 가벼운 기념품입니다.",
    tags: ["Korean native dog keyring", "Korean culture gift", "한국 토종견 키링", "K-Culture Goods"]
  },
  {
    name: "Hanji Ginkgo Leaf Fan",
    koreanName: "한지 은행잎 부채",
    description:
      "The Hanji Ginkgo Leaf Fan is a handcrafted-style fan inspired by the shape of a ginkgo leaf and the visual texture of Korean Hanji paper. It is a light, elegant, and giftable Korean heritage object for cultural events and everyday display.",
    koreanDescription:
      "한지 은행잎 부채는 은행잎의 곡선과 한지의 질감을 살린 우아한 전통문화 굿즈입니다. 가볍고 선물하기 쉬운 한국문화 오브제로 활용할 수 있습니다.",
    tags: ["Hanji", "Hanji fan", "한지 은행잎 부채", "Korean heritage goods"]
  },
  {
    name: "Kim Hong-do Painting Blanket",
    koreanName: "김홍도 풍속화 담요",
    description:
      "The Kim Hong-do Painting Blanket is a soft home textile concept using Korean genre painting inspired by Joseon-era everyday life scenes. It connects Korean painting, warm gift culture, and modern lifestyle goods for rooms, studios, and campus living.",
    koreanDescription:
      "김홍도 풍속화 담요는 조선 시대 일상의 장면을 담은 한국 회화 감성을 부드러운 홈 텍스타일로 연결합니다. 따뜻한 선물 문화와 한국 전통 미감을 함께 담은 김홍도 담요 콘셉트입니다.",
    tags: ["Kim Hong-do", "Korean lifestyle goods", "김홍도 담요", "Korean culture gift"]
  },
  {
    name: "Arrow Pen",
    koreanName: "화살펜",
    description:
      "The Arrow Pen is a Korean heritage-inspired stationery product reimagining the form of a traditional arrow as a functional pen. It connects Korean traditional archery, study culture, and modern collectible product design.",
    koreanDescription:
      "화살펜은 한국 전통 활쏘기 굿즈의 형태를 일상적인 필기구로 재해석한 상품입니다. 국궁의 선과 현대적인 수집형 문구 디자인을 함께 보여줍니다.",
    tags: ["Arrow Pen", "Korean traditional archery", "화살펜", "한국 전통 활쏘기 굿즈"]
  }
];

const goodsCollectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: goodsPageTitle,
  description:
    "K_LINE Goods introduces Korean heritage goods and K-culture products inspired by Hanji, Dancheong, Najeonchilgi, Korean calligraphy, Korean native dogs, Kim Hong-do painting, and Korean traditional archery.",
  url: absoluteUrl("/goods"),
  isPartOf: {
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url
  },
  mainEntity: {
    "@type": "ItemList",
    itemListElement: goodsSeoSections.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${item.name} / ${item.koreanName}`,
      description: item.description
    }))
  }
};

export default function GoodsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(goodsCollectionJsonLd) }}
      />
      <section className="relative isolate overflow-hidden bg-hanji text-ink">
        <div className="absolute inset-y-0 right-0 hidden w-[58%] md:block">
          <img
            src="/images/goods-hero-clean.jpg"
            alt="Korean heritage lifestyle goods including a dancheong mug, calligraphy light object, najeonchilgi plate, fan, blanket, and keyrings"
            width={780}
            height={600}
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-y-0 left-0 w-52 bg-gradient-to-r from-hanji to-transparent" />
          <div className="absolute inset-0 bg-hanji/10" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(214,168,90,0.18),transparent_34%),linear-gradient(90deg,#F4EBDD_0%,#F4EBDD_42%,rgba(244,235,221,0.78)_62%,rgba(244,235,221,0.18)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-hanji to-transparent" />
        <div className="relative mx-auto flex min-h-[460px] max-w-7xl items-center px-5 py-16 md:min-h-[560px] md:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase text-brass">
              <I18nText en="K_LINE Goods" ko="K_LINE 상품" />
            </p>
            <h1 className="mt-4 break-keep font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl md:text-6xl">
              <I18nText en="Korean Heritage for Everyday Life" ko="한국의 유산을 일상과 함께" />
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-ink/72 md:text-lg">
              <I18nText
                en="Hanji, dancheong, najeonchilgi, traditional motifs, and modern lifestyle goods."
                ko="한지, 단청, 나전칠기, 전통 문양을 오늘의 라이프스타일 굿즈로 소개합니다."
              />
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-normal text-ink/64">
              <span className="border border-brass/35 bg-white/45 px-3 py-2">
                <I18nText en="Korean heritage" ko="한국 유산" />
              </span>
              <span className="border border-brass/35 bg-white/45 px-3 py-2">
                <I18nText en="Crafted objects" ko="문화 오브젝트" />
              </span>
              <span className="border border-brass/35 bg-white/45 px-3 py-2">
                <I18nText en="Made for everyday" ko="일상을 위한 굿즈" />
              </span>
            </div>
            <div className="mt-10 overflow-hidden border border-brass/25 bg-white/35 shadow-soft md:hidden">
              <img
                src="/images/goods-hero-clean.jpg"
                alt="Korean heritage lifestyle goods"
                width={780}
                height={600}
                loading="lazy"
                decoding="async"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow={<I18nText en="Cultural objects" ko="문화 오브젝트" />}
            title={<I18nText en="Cultural objects with a Korean line" ko="한국의 선을 담은 문화 오브젝트" />}
            description={
              <I18nText
                en="Each card includes the product image, story, inquiry price placeholder, detail page, and cart inquiry action."
                ko="각 카드에는 상품 이미지, 이야기, 가격 안내, 상세 보기, 장바구니 문의 기능이 포함됩니다."
              />
            }
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {goods.map((item) => (
              <GoodsCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/55 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="K_LINE Goods"
            title="Korean heritage goods and K-culture gift ideas"
            description="K_LINE Goods introduces Korean heritage-inspired lifestyle goods for international students, campus communities, cultural projects, and people looking for meaningful Korean culture gifts."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {goodsSeoSections.map((item) => (
              <article
                key={item.name}
                className="grid content-start gap-4 border border-ink/10 bg-paper/88 p-5 shadow-soft transition hover:-translate-y-1 hover:border-brass/55 hover:bg-white"
              >
                <div>
                  <p className="text-xs font-semibold uppercase text-brass">K-Culture Goods</p>
                  <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{item.name}</h3>
                  <p className="mt-1 break-keep text-sm font-semibold text-ink/62">{item.koreanName}</p>
                </div>
                <p className="text-sm leading-7 text-ink/72">{item.description}</p>
                <p className="break-keep text-sm leading-7 text-ink/68">{item.koreanDescription}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="border border-brass/25 bg-hanji/80 px-2.5 py-1 text-xs font-semibold text-ink/68"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
