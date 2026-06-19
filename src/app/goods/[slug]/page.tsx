import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GoodsDetail } from "@/components/GoodsDetail";
import { getGoodsBySlug, goods } from "@/data/goods";
import { requireDeveloperAccess } from "@/lib/privilegedAccess";
import { absoluteUrl, seoKeywords, siteConfig } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return goods.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getGoodsBySlug(slug);
  if (!item) {
    return {
      title: "Goods Detail"
    };
  }

  return {
    title: item.name,
    description: item.fullDescription,
    keywords: seoKeywords,
    alternates: {
      canonical: `${siteConfig.url}/goods/${item.slug}`
    },
    openGraph: {
      title: `${item.name} | ${siteConfig.name}`,
      description: item.shortDescription,
      url: `${siteConfig.url}/goods/${item.slug}`,
      siteName: siteConfig.name,
      images: [
        {
          url: item.images[0].src,
          alt: item.images[0].alt
        }
      ],
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: `${item.name} | ${siteConfig.name}`,
      description: item.shortDescription,
      images: [item.images[0].src]
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

export default async function GoodsDetailPage({ params }: PageProps) {
  await requireDeveloperAccess();

  const { slug } = await params;
  const item = getGoodsBySlug(slug);

  if (!item) {
    notFound();
  }

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    alternateName: item.koreanName,
    description: item.fullDescription,
    image: item.images.map((image) => absoluteUrl(image.src)),
    brand: {
      "@type": "Brand",
      name: siteConfig.name
    },
    category: item.category,
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: item.estimatedPriceEur,
      availability: "https://schema.org/PreOrder",
      url: absoluteUrl(`/goods/${item.slug}`)
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <GoodsDetail item={item} />
    </>
  );
}
