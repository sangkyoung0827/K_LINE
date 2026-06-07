import type { Metadata } from "next";
import "@/app/globals.css";
import { CartProvider } from "@/components/CartProvider";
import { Layout } from "@/components/Layout";
import { seoKeywords, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  keywords: seoKeywords,
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: "/images/k-line-hero.png",
        width: 1792,
        height: 1024,
        alt: "K_LINE Korean cultural platform hero image"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  alternates: {
    canonical: siteConfig.url
  }
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  alternateName: ["Han-hwal", "한활", "Korean Lines"],
  url: siteConfig.url,
  sameAs: [siteConfig.youtube],
  description: siteConfig.description,
  keywords: seoKeywords.join(", ")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <CartProvider>
          <Layout>{children}</Layout>
        </CartProvider>
      </body>
    </html>
  );
}
