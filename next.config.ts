import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/ecc/official-team-qr": ["./private/ecc-official-team-qr.png"]
  },
  poweredByHeader: false,
  async headers() {
    const staticImageCache = "public, max-age=86400, stale-while-revalidate=604800";

    return [
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: staticImageCache
          }
        ]
      },
      {
        source: "/:path*.svg",
        headers: [
          {
            key: "Cache-Control",
            value: staticImageCache
          }
        ]
      }
    ];
  }
};

export default nextConfig;
