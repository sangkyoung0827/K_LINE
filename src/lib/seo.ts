export const siteConfig = {
  name: "K_LINE",
  repositoryName: "K_LINE",
  title: "K_LINE | Korean Cultural Dashboard Platform",
  koreanTitle: "한국의 선, 유럽을 잇다",
  description:
    "K_LINE is a Korean cultural dashboard platform for cultural goods, K-culture projects, Han-hwal, Hanji, Korean calligraphy, Korean traditional archery, and community activities.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://kline-nine-wheat.vercel.app",
  youtube: "https://www.youtube.com/@Weirdsang",
  instagramPlaceholder: "Instagram placeholder to be connected later",
  emailPlaceholder: "contact@k-line.example"
};

export const seoKeywords = [
  "K_LINE",
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
