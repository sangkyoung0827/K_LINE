import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityPostCard } from "@/components/ActivityPostCard";
import { CategoryBadge } from "@/components/CategoryBadge";
import { SectionHeader } from "@/components/SectionHeader";
import { TagBadge } from "@/components/TagBadge";
import {
  activities,
  getActivityBySlug,
  isDeveloperOnlyActivity,
  publicActivities
} from "@/data/activities";
import { requireDeveloperAccess } from "@/lib/privilegedAccess";
import { absoluteUrl, createNoIndexMetadata, seoKeywords, siteConfig } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return publicActivities.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getActivityBySlug(slug);

  if (!post) {
    return {
      title: "International Clubs"
    };
  }

  if (isDeveloperOnlyActivity(post)) {
    return createNoIndexMetadata({
      title: post.title,
      description: post.excerpt,
      path: `/our-activities/${post.slug}`
    });
  }

  return {
    title: post.title,
    description: post.excerpt,
    keywords: seoKeywords,
    alternates: {
      canonical: `${siteConfig.url}/our-activities/${post.slug}`
    },
    openGraph: {
      title: `${post.title} | ${siteConfig.name}`,
      description: post.excerpt,
      url: `${siteConfig.url}/our-activities/${post.slug}`,
      siteName: siteConfig.name,
      images: [
        {
          url: post.image.src,
          alt: post.image.alt
        }
      ],
      type: "article"
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} | ${siteConfig.name}`,
      description: post.excerpt,
      images: [post.image.src]
    }
  };
}

export default async function ActivityDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getActivityBySlug(slug);

  if (!post) {
    notFound();
  }

  if (isDeveloperOnlyActivity(post)) {
    await requireDeveloperAccess();
  }

  const relatedPosts = publicActivities.filter((item) => item.slug !== post.slug).slice(0, 2);
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: absoluteUrl(post.image.src),
    author: {
      "@type": "Person",
      name: post.author
    },
    datePublished: post.date
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <section className="bg-ink py-16 text-paper md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[0.95fr_1.05fr] md:px-8">
          <div>
            <CategoryBadge label={post.category} />
            <h1 className="mt-5 font-serif text-5xl font-semibold md:text-7xl">{post.title}</h1>
            <p className="mt-5 text-sm text-paper/62">
              By {post.author} / {post.date}
            </p>
            <p className="mt-6 text-lg leading-8 text-paper/72">{post.excerpt}</p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden bg-hanji">
            <Image
              src={post.image.src}
              alt={post.image.alt}
              fill
              priority
              sizes="(min-width: 768px) 55vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-4xl px-5 md:px-8">
          <article className="paper-panel p-6 md:p-8">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <TagBadge key={tag} label={tag} />
              ))}
            </div>
            <p className="mt-8 text-base leading-8 text-ink/74">{post.content}</p>
          </article>
          <Link
            href="/our-activities"
            className="mt-8 inline-flex text-sm font-semibold text-ink underline underline-offset-4"
          >
            Back to list
          </Link>
        </div>
      </section>

      <section className="bg-white/50 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Related posts"
            title="More club records"
            description="Continue reading K_LINE news, reviews, field notes, and community stories."
          />
          <div className="mt-10 grid gap-5">
            {relatedPosts.map((item) => (
              <ActivityPostCard key={item.id} post={item} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
