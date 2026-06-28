import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/k-culture-project",
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
          "/ecc-alumni/activity-inquiry",
          "/ecc-alumni/rejoin",
          "/ecc-alumni/status",
          "/goods",
          "/goods/",
          "/k-culture-project/submit",
          "/products",
          "/products/",
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
