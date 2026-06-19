import type { Metadata } from "next";
import "@/app/globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { CartProvider } from "@/components/CartProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { Layout } from "@/components/Layout";
import { SiteVisitTracker } from "@/components/SiteVisitTracker";
import { WoohyukmonChatbot } from "@/components/WoohyukmonChatbot";
import { seoKeywords, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  keywords: seoKeywords,
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.socialDescription,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: "/images/k-line-hero.jpg",
        width: 1600,
        height: 840,
        alt: "K_LINE Korean cultural platform hero image"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.socialDescription,
    images: ["/images/k-line-hero.jpg"]
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: siteConfig.url
  },
  verification: {
    google: ["googlefd1a14b874829389.html", "fd1a14b874829389"]
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/k-line-mark.svg"
  },
  appleWebApp: {
    capable: true,
    title: siteConfig.shortName
  }
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  alternateName: ["K_LINE", "KLINE", "K_LINE Campus K-Culture Hub", "K_LINE ECC", "Han-hwal", "한활", "Korean Lines"],
  url: siteConfig.url,
  sameAs: [siteConfig.youtube],
  description: siteConfig.description,
  keywords: seoKeywords.join(", ")
};

const websiteJsonLd = {
  "@context": "https://schema.org/",
  "@type": "WebSite",
  name: siteConfig.name,
  alternateName: ["K_LINE", "KLINE", "K_LINE Campus K-Culture Hub", "K_LINE ECC"],
  url: siteConfig.url
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <LanguageProvider>
          <CartProvider>
            <AuthProvider>
              <Layout>{children}</Layout>
              <SiteVisitTracker />
              <WoohyukmonChatbot />
            </AuthProvider>
          </CartProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
