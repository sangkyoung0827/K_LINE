import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.socialDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#F4EBDD",
    theme_color: "#1F2A44",
    icons: [
      {
        src: "/images/k-line-official-logo.png",
        sizes: "422x386",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/images/k-line-official-logo.png",
        sizes: "422x386",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
