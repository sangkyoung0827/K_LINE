import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/goods",
          "/k-culture-project",
          "/our-activities",
          "/our-activities/ecc",
          "/our-activities/hanhwal",
          "/contact"
        ],
        disallow: [
          "/admin",
          "/api/",
          "/developer/",
          "/login",
          "/request-admin",
          "/cart",
          "/checkout",
          "/donate",
          "/ecc-join",
          "/ecc-official",
          "/k-culture-project/submit",
          "/our-activities/write",
          "/our-activities/ecc/register",
          "/our-activities/ecc/activity",
          "/our-activities/ecc/fund",
          "/our-activities/ecc/members"
        ]
      }
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`
  };
}
