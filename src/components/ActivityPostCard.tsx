import Image from "next/image";
import Link from "next/link";
import type { ActivityPost } from "@/types";
import { CategoryBadge } from "@/components/CategoryBadge";
import { TagBadge } from "@/components/TagBadge";

export function ActivityPostCard({ post }: { post: ActivityPost }) {
  return (
    <article className="paper-panel grid gap-5 overflow-hidden p-4 transition hover:border-brass hover:bg-white/65 md:grid-cols-[220px_1fr]">
      <Link href={`/our-activities/${post.slug}`} className="relative aspect-[4/3] overflow-hidden bg-hanji">
        <Image
          src={post.image.src}
          alt={post.image.alt}
          fill
          sizes="(min-width: 768px) 220px, 100vw"
          className="object-cover transition duration-500 hover:scale-105"
        />
      </Link>
      <div className="grid content-start gap-3 p-1">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge label={post.category} />
          <span className="text-xs text-ink/52">{post.date}</span>
        </div>
        <h2 className="font-serif text-3xl font-semibold text-ink">{post.title}</h2>
        <p className="text-sm text-ink/58">By {post.author}</p>
        <p className="text-sm leading-7 text-ink/70">{post.excerpt}</p>
        <div className="flex flex-wrap gap-2">
          {post.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} label={tag} />
          ))}
        </div>
        <Link
          href={`/our-activities/${post.slug}`}
          className="mt-2 inline-flex min-h-10 w-fit items-center border border-ink/18 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
        >
          Read More
        </Link>
      </div>
    </article>
  );
}
