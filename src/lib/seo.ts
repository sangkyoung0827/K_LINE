import type { Metadata } from "next";

const fallbackSiteUrl = "https://kline-nine-wheat.vercel.app";

function normalizeSiteUrl(value: string) {
  return value.replace(/\/$/, "");
}

export const siteConfig = {
  name: "K_LINE",
  shortName: "K_LINE",
  repositoryName: "K_LINE",
  title: "K_LINE | Korea Campus K-Culture & International Student Hub",
  homeTitle: "K_LINE | Korea Campus K-Culture & International Student Hub",
  koreanTitle: "K_LINE",
  description:
    "K_LINE is a Korea-based campus K-culture and international student platform connecting international students, Korean university communities, clubs, local experiences and cultural programs.",
  homeDescription:
    "K_LINE connects international students with Korean campus communities, K-culture experiences, local activities, clubs and cultural programs.",
  socialDescription:
    "K_LINE connects international students with Korean campus communities, K-culture experiences, local activities, clubs and cultural programs.",
  manifestDescription: "Korea Campus K-Culture and International Student Hub",
  url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? fallbackSiteUrl),
  youtube: "https://www.youtube.com/@Weirdsang",
  instagramPlaceholder: "Instagram placeholder to be connected later",
  emailPlaceholder: "sangkyoung1004@naver.com"
};

export const seoKeywords = [
  "K_LINE",
  "KLINE",
  "KLINE Korea",
  "KLINE Campus",
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
  "Korean campus",
  "Korean campus community",
  "Korea international student",
  "international students Korea",
  "Korea international student community",
  "Jeonbuk National University",
  "JBNU international students",
  "전북대학교",
  "전북대학교 외국인",
  "외국인 유학생",
  "한국 유학생",
  "한국 문화 체험",
  "외국인 한국 문화",
  "Jeonbuk K-culture",
  "국궁",
  "한활",
  "전북 K-컬처"
];

export function absoluteUrl(path: string) {
  return new URL(path, `${siteConfig.url}/`).toString();
}

const defaultOgImage = {
  url: "/images/k-line-hero.jpg",
  width: 1600,
  height: 840,
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
