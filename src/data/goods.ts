import type { GoodsItem } from "@/types";

export const goods: GoodsItem[] = [
  {
    id: "goods-led-object",
    slug: "hanji-calligraphy-led-light-object",
    name: "Hanji Calligraphy LED Light Object",
    koreanName: "한지 서예 LED 오브제",
    shortDescription:
      "A small mood lamp combining Hanji texture, Korean calligraphy rhythm, a 3D-printed frame, and warm LED light.",
    fullDescription:
      "A small decorative mood lamp that combines Korean Hanji paper, Korean calligraphy, a 3D-printed frame, and warm LED lighting. The object is designed as a modern interior piece that presents the texture of Hanji and the visual rhythm of Korean calligraphy through light.",
    story:
      "This object translates the Korean line into light: the fiber of Hanji, the movement of brushwork, and the precision of digital fabrication meet in a compact cultural object designed for desks, exhibitions, and gifts.",
    pricePlaceholder: "Inquiry price placeholder: EUR 120 estimate",
    estimatedPriceEur: 120,
    dimensions: "approx. 14.6 cm x 20.9 cm x 3 cm",
    materials: ["Hanji-style front panel", "3D-printed frame", "LED light module"],
    useCases: ["Desk lamp", "Cultural gift", "Interior object", "K-culture souvenir"],
    category: "K-culture goods",
    images: [
      {
        src: "/images/hanji-calligraphy-led-light-object.png",
        alt: "Hanji Calligraphy LED Light Object with warm light and Korean calligraphy-inspired lines"
      }
    ],
    specifications: {
      Size: "approx. 14.6 cm x 20.9 cm x 3 cm",
      Light: "Warm LED light module",
      Finish: "Hanji-style illuminated front panel with black frame",
      Status: "Inquiry-based ordering before production/payment integration"
    }
  },
  {
    id: "goods-arrow-pen",
    slug: "arrow-pen",
    name: "Arrow Pen",
    koreanName: "화살펜",
    shortDescription:
      "A usable pen shaped by the visual language of Korean traditional archery, with a transparent protective cap.",
    fullDescription:
      "A functional pen inspired by Korean traditional archery. The object has the visual form of an arrow while containing a usable pen inside. A transparent cap protects the pen tip. It is designed as a practical cultural souvenir connected to Korean archery and traditional martial culture.",
    story:
      "The Arrow Pen makes the archery line portable. It connects writing, study, exhibition shops, and Korean traditional martial culture through a daily object that still carries the shape of the bow range.",
    pricePlaceholder: "Inquiry price placeholder: EUR 18 estimate",
    estimatedPriceEur: 18,
    dimensions: "approx. 22 cm length x 0.8 cm diameter",
    materials: ["Arrow-shaped body", "Inner pen", "Transparent cap"],
    useCases: ["Writing tool", "Cultural souvenir", "Archery-themed gift", "Exhibition shop item"],
    category: "Korean traditional goods",
    images: [
      {
        src: "/images/arrow-pen.png",
        alt: "Arrow Pen inspired by Korean traditional archery on Hanji paper"
      }
    ],
    specifications: {
      Size: "approx. 22 cm length x 0.8 cm diameter",
      Form: "Arrow-inspired pen body",
      Cap: "Transparent protective cap",
      Status: "Inquiry-based ordering before production/payment integration"
    }
  }
];

export function getGoodsBySlug(slug: string) {
  return goods.find((item) => item.slug === slug);
}
