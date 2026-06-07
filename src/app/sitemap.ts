import type { MetadataRoute } from "next";
import { activities } from "@/data/activities";
import { goods } from "@/data/goods";
import { projects } from "@/data/projects";
import { siteConfig } from "@/lib/seo";

const staticRoutes = [
  "",
  "/goods",
  "/k-culture-project",
  "/k-culture-project/submit",
  "/k-culture-project/han-hwal",
  "/our-activities",
  "/our-activities/ecc",
  "/our-activities/hanhwal",
  "/our-activities/write",
  "/login",
  "/cart",
  "/checkout",
  "/contact"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries = staticRoutes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.8
  }));

  const goodsEntries = goods.map((item) => ({
    url: `${siteConfig.url}/goods/${item.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7
  }));

  const projectEntries = projects
    .filter((project) => project.slug !== "han-hwal")
    .map((project) => ({
      url: `${siteConfig.url}/k-culture-project/${project.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7
    }));

  const activityEntries = activities.map((post) => ({
    url: `${siteConfig.url}/our-activities/${post.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.65
  }));

  return [...staticEntries, ...goodsEntries, ...projectEntries, ...activityEntries];
}
