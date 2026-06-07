import type { MetadataRoute } from "next";
import { goods } from "@/data/goods";
import { siteConfig } from "@/lib/seo";

const staticRoutes = [
  "",
  "/han-hwal",
  "/archery-class",
  "/k-culture-project",
  "/goods",
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

  return [...staticEntries, ...goodsEntries];
}
