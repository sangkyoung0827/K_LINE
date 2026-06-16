import type { ProjectItem } from "@/types";

export const projects: ProjectItem[] = [
  {
    id: "project-london",
    slug: "london",
    title: "From Word to Light",
    englishTitle: "From Word to Light",
    teamOrAuthor: "K_LINE project team",
    category: "Online Exhibition",
    location: "London, United Kingdom",
    shortDescription:
      "A hands-on K-Culture exhibition where Hangul, Jeonju Hanji, 3D printing, and light become one personal object.",
    fullDescription:
      "Participants choose a Korean word, use a detachable 3D printed Hangul guide plate, trace or press the word onto Jeonju Hanji, and place the Hanji inside a 3D printed frame to create a personal Hanji light object.",
    image: {
      src: "/images/london-project-object.jpg",
      alt: "Hanji light object prototype for the From Word to Light exhibition"
    },
    detailImage: {
      src: "/images/london-project-object.jpg",
      alt: "Korean calligraphy LED object prepared for the K_LINE London project"
    },
    tags: ["Hanji", "Hangul", "3D printing", "K-Culture workshop", "Light object"],
    date: "2026-06-14"
  }
];

export function getProjectBySlug(slug: string) {
  return projects.find((project) => project.slug === slug);
}
