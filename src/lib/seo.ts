import type { Metadata } from "next";

export const siteConfig = {
  name: "K_LINE",
  repositoryName: "K_LINE",
  title: "K_LINE | Campus K-Culture Hub",
  koreanTitle: "K_LINE",
  description:
    "K_LINE is a campus-based K-culture platform connecting Korean cultural projects, goods, ECC, Han-hwal, and international student activities.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://kline-nine-wheat.vercel.app",
  youtube: "https://www.youtube.com/@Weirdsang",
  instagramPlaceholder: "Instagram placeholder to be connected later",
  emailPlaceholder: "sangkyoung1004@naver.com"
};

export const seoKeywords = [
  "K_LINE",
  "K-Culture",
  "Korean culture project",
  "ECC",
  "Campus K-Culture Hub",
  "international students",
  "university K-culture",
  "campus community",
  "campus culture",
  "K-culture project",
  "Korean traditional archery",
  "Korean archery class",
  "Han-hwal",
  "Hanji",
  "Korean calligraphy",
  "K-culture goods",
  "Korean cultural goods",
  "Jeonbuk K-culture",
  "Korean cultural object",
  "Korean traditional goods",
  "국궁",
  "한활",
  "한지",
  "서예",
  "전북 K-컬처",
  "화살펜"
];

export function absoluteUrl(path: string) {
  return `${siteConfig.url}${path}`;
}

const defaultOgImage = {
  url: "/images/k-line-hero.png",
  width: 1792,
  height: 1024,
  alt: "K_LINE campus K-culture platform"
};

type SeoMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  imageAlt?: string;
};

export function createPublicMetadata({
  description,
  imageAlt,
  keywords = [],
  path,
  title
}: SeoMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const ogImage = {
    ...defaultOgImage,
    alt: imageAlt ?? defaultOgImage.alt
  };

  return {
    title,
    description,
    keywords: Array.from(new Set([...seoKeywords, ...keywords])),
    alternates: {
      canonical: url
    },
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description,
      url,
      siteName: siteConfig.name,
      images: [ogImage],
      locale: "en_US",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.name}`,
      description,
      images: [ogImage.url]
    },
    robots: {
      index: true,
      follow: true
    }
  };
}

export function createNoIndexMetadata({
  description,
  path,
  title
}: SeoMetadataOptions): Metadata {
  const url = absoluteUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical: url
    },
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false
      }
    }
  };
}
