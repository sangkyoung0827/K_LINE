import type { Metadata } from "next";
import { HeroSection } from "@/components/HeroSection";
import { HomeTrackSections } from "@/components/HomeTrackSections";
import { seoKeywords, siteConfig } from "@/lib/seo";
import { auth } from "@/auth";
import { canUseCoDevelopment } from "@/lib/coDevelopment/model";
import { getGksHubAccess } from "@/lib/gksHub/access";
import { GksHubCard } from "@/components/gks-hub/GksHubCard";

export const metadata: Metadata = {
  title: {
    absolute: siteConfig.homeTitle
  },
  description: siteConfig.homeDescription,
  keywords: seoKeywords,
  openGraph: {
    title: siteConfig.homeTitle,
    description: siteConfig.socialDescription,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: "/images/k-line-hero.jpg",
        width: 1600,
        height: 840,
        alt: "K_LINE campus K-culture hub"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.homeTitle,
    description: siteConfig.socialDescription,
    images: ["/images/k-line-hero.jpg"]
  },
  alternates: {
    canonical: siteConfig.url
  },
  verification: {
    google: ["googlefd1a14b874829389.html", "fd1a14b874829389"]
  },
  robots: {
    index: true,
    follow: true
  }
};

export default async function HomePage() {
  const session = await auth();
  const gksAccess = await getGksHubAccess();
  return (
    <>
      <HeroSection />
      <HomeTrackSections showEventStudio={Boolean(session?.user?.email)} showCoDevelopment={canUseCoDevelopment(session?.user?.email)} developerServices={gksAccess.allowed ? <GksHubCard /> : null} />
    </>
  );
}
