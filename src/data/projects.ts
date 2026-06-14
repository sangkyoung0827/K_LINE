import type { ProjectItem } from "@/types";

export const projects: ProjectItem[] = [
  {
    id: "project-london",
    slug: "london",
    title: "London",
    englishTitle: "London",
    teamOrAuthor: "K_LINE project team",
    category: "International Project",
    location: "London, United Kingdom",
    shortDescription:
      "A student-led international project connecting Korean cultural objects, London, and campus communities.",
    fullDescription:
      "London is a K_LINE international project space where students can upload project notes, field records, photos, and ideas connected to Korean cultural objects, London, and global exchange. The project starts from a Korean calligraphy LED object and grows through student contributions.",
    image: {
      src: "/images/london-dashboard.jpg",
      alt: "London city view for the K_LINE London project"
    },
    detailImage: {
      src: "/images/london-project-object.jpg",
      alt: "Korean calligraphy LED object prepared for the K_LINE London project"
    },
    tags: ["London", "K-culture", "Student project", "Cultural exchange"],
    date: "2026-06-14"
  }
];

export function getProjectBySlug(slug: string) {
  return projects.find((project) => project.slug === slug);
}
