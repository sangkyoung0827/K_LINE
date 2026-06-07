import type { Metadata } from "next";
import ProjectDetailPage from "@/app/k-culture-project/[slug]/page";
import { seoKeywords } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Han-hwal",
  description:
    "한활 Han-hwal is a K_LINE K-culture project and community that trains body and mind through Korean traditional archery.",
  keywords: seoKeywords,
  openGraph: {
    title: "Han-hwal | K_LINE K-Culture Project",
    description:
      "우리는 국궁으로 심신을 수련하는 한활입니다. Han-hwal is a community that trains body and mind through Korean traditional archery."
  }
};

export default function HanHwalProjectPage() {
  return <ProjectDetailPage params={Promise.resolve({ slug: "han-hwal" })} />;
}
