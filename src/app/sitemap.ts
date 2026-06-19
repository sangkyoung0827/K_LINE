import type { MetadataRoute } from "next";
import { activities } from "@/data/activities";
import { siteConfig } from "@/lib/seo";

const publicRoutes = [
  "",
  "/goods",
  "/k-culture-project",
  "/our-activities",
  "/our-activities/ecc",
  "/our-activities/hanhwal",
  "/contact"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const detailRoutes = [
    ...activities.map((post) => `/our-activities/${post.slug}`)
  ];

  return [
    ...publicRoutes.map((route) => ({
      url: `${siteConfig.url}${route}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.8
    })),
    ...detailRoutes.map((route) => ({
      url: `${siteConfig.url}${route}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7
    }))
  ];
}
