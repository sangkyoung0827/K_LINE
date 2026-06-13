export const siteConfig = {
  name: "K_LINE",
  repositoryName: "K_LINE",
  title: "K_LINE | Campus K-Culture Hub",
  koreanTitle: "K_LINE",
  description:
    "K_LINE is a campus K-culture platform connecting Korean cultural projects, goods, and international student clubs for university communities.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://kline-nine-wheat.vercel.app",
  youtube: "https://www.youtube.com/@Weirdsang",
  instagramPlaceholder: "Instagram placeholder to be connected later",
  emailPlaceholder: "sangkyoung1004@naver.com"
};

export const seoKeywords = [
  "K_LINE",
  "Campus K-Culture Hub",
  "international students",
  "university K-culture",
  "campus community",
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
