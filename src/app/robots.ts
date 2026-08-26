import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/archery-class",
          "/our-activities",
          "/our-activities/ecc",
          "/our-activities/hanhwal",
          "/contact",
          "/ecc-alumni",
          "/ecc-alumni/notices"
        ],
        disallow: [
          "/admin",
          "/api/",
          "/developer/",
          "/international-student-club/",
          "/login",
          "/member/",
          "/request-admin",
          "/cart",
          "/checkout",
          "/donate",
          "/ecc-join",
          "/ecc-official",
          "/hanhwal-join",
          "/hanhwal-official",
          "/han-hwal",
          "/ecc-alumni/activity-inquiry",
          "/ecc-alumni/rejoin",
          "/ecc-alumni/status",
          "/goods",
          "/goods/",
          "/jeju",
          "/k-culture-project",
          "/k-culture-project/submit",
          "/products",
          "/products/",
          "/our-activities/write",
          "/our-activities/ecc/",
          "/our-activities/hanhwal/",
          "/register",
          "/v4"
        ]
      }
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url
  };
}
