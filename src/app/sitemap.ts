import type { MetadataRoute } from "next";
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

  return publicRoutes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.8
  }));
}
