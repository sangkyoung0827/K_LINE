import type { ActivityPost } from "@/types";

export const activities: ActivityPost[] = [
  {
    id: "activity-han-hwal-students",
    slug: "han-hwal-korean-archery-experience-international-students",
    title: "Han-hwal Korean Archery Experience with International Students",
    category: "Activity Log",
    author: "K_LINE activity team",
    date: "2026-06-07",
    excerpt:
      "A field record about sharing Korean traditional archery posture, safety, and cultural meaning with international students.",
    content:
      "This activity note records a Han-hwal Korean archery experience for international students. The session focused on safety rules, posture, breath, concentration, and the cultural meaning of Korean traditional archery as body-mind training.",
    image: {
      src: "/images/k-line-hero.jpg",
      alt: "Han-hwal Korean archery experience activity image"
    },
    tags: ["Han-hwal", "Korean traditional archery", "International students"]
  },
  {
    id: "activity-project-planning",
    slug: "jeonbuk-k-culture-project-planning-note",
    title: "Jeonbuk K-Culture Project Planning Note",
    category: "Field Note",
    author: "K_LINE project archive",
    date: "2026-06-07",
    excerpt:
      "A planning note for connecting Jeonbuk Hanji, Korean calligraphy, fabrication, and cultural exchange.",
    content:
      "This planning note outlines how K_LINE can connect Jeonbuk Hanji, Korean calligraphy, digital fabrication, warm LED lighting, and European cultural exchange through project documentation and public participation.",
    image: {
      src: "/images/hanji-calligraphy-led-light-object.jpg",
      alt: "Jeonbuk K-culture project planning note image"
    },
    tags: ["Jeonbuk K-culture", "Hanji", "Korean calligraphy"]
  },
  {
    id: "activity-led-object-review",
    slug: "hanji-led-object-prototype-review",
    title: "Hanji LED Object Prototype Review",
    category: "Review",
    author: "Prototype review placeholder",
    date: "2026-06-07",
    excerpt:
      "A review of the first Hanji Calligraphy LED Light Object prototype as a cultural interior object.",
    content:
      "The Hanji LED Object prototype review focuses on paper texture, calligraphy rhythm, frame scale, warm lighting, and whether the object works as a desk lamp, cultural gift, and K-culture souvenir.",
    image: {
      src: "/images/hanji-calligraphy-led-light-object.jpg",
      alt: "Hanji LED object prototype review image"
    },
    tags: ["Hanji", "LED object", "Prototype"]
  },
  {
    id: "activity-arrow-pen-log",
    slug: "arrow-pen-design-development-log",
    title: "Arrow Pen Design Development Log",
    category: "News",
    author: "Goods design placeholder",
    date: "2026-06-07",
    excerpt:
      "A development log for the Arrow Pen, a practical souvenir inspired by Korean traditional archery.",
    content:
      "The Arrow Pen design development log records decisions around arrow-inspired silhouette, writing usability, transparent cap protection, packaging, and its role as a Korean traditional archery souvenir.",
    image: {
      src: "/images/arrow-pen.jpg",
      alt: "Arrow Pen design development log image"
    },
    tags: ["Arrow Pen", "화살펜", "Goods"]
  }
];

export function getActivityBySlug(slug: string) {
  return activities.find((post) => post.slug === slug);
}
