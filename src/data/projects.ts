import type { ProjectItem } from "@/types";

export const projects: ProjectItem[] = [
  {
    id: "project-korean-lines-europe",
    slug: "connecting-korean-lines-to-europe",
    title: "한국의 선, 유럽을 잇다",
    englishTitle: "Connecting Korean Lines to Europe",
    teamOrAuthor: "K_LINE project team placeholder",
    category: "Jeonbuk K-Culture",
    location: "Jeonbuk / London / Europe",
    shortDescription:
      "A Jeonbuk K-culture project connecting Hanji, Korean calligraphy, 3D printing, LED lighting, and Europe.",
    fullDescription:
      "This project connects Jeonbuk Hanji, Korean calligraphy, 3D printing, LED lighting, and Europe through a compact Hanji Calligraphy LED Light Object. It introduces Jeonbuk traditional culture through modern design, digital fabrication, and a cultural exchange plan for European audiences.",
    image: {
      src: "/images/hanji-calligraphy-led-light-object.png",
      alt: "Hanji Calligraphy LED Light Object for Connecting Korean Lines to Europe"
    },
    tags: ["Hanji", "Korean calligraphy", "LED object", "Jeonbuk K-culture"],
    date: "2026-06-07"
  },
  {
    id: "project-han-hwal",
    slug: "han-hwal",
    title: "한활",
    englishTitle: "Han-hwal",
    teamOrAuthor: "Han-hwal community placeholder",
    category: "Korean Traditional Archery",
    location: "Korea / International exchange",
    shortDescription: "우리는 국궁으로 심신을 수련하는 한활입니다.",
    fullDescription:
      "Han-hwal is a community that trains body and mind through Korean traditional archery. It introduces 국궁, discipline, posture, body-mind training, and cultural practice to Korean students, international students, foreign visitors, and cultural groups.",
    image: {
      src: "/images/k-line-hero.png",
      alt: "Korean traditional bow and Hanji paper representing Han-hwal"
    },
    tags: ["Han-hwal", "국궁", "Korean traditional archery", "Body-mind training"],
    date: "2026-06-07"
  }
];

export function getProjectBySlug(slug: string) {
  return projects.find((project) => project.slug === slug);
}
