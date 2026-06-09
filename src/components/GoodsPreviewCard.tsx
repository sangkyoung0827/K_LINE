"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import type { GoodsItem } from "@/types";

export function GoodsPreviewCard({ item }: { item: GoodsItem }) {
  const image = item.images[0];
  const { language } = useLanguage();

  return (
    <Link
      href={`/goods/${item.slug}`}
      className="paper-panel group grid overflow-hidden shadow-soft transition hover:-translate-y-1 hover:border-brass hover:bg-white/80 hover:shadow-lift md:grid-cols-[190px_1fr]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-hanji md:aspect-auto md:min-h-52">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 768px) 190px, 100vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="grid content-between gap-5 p-6">
        <div>
          <p className="text-sm font-semibold uppercase text-brass">
            {language === "ko" ? "문화 상품" : item.category}
          </p>
          <h3 className="mt-3 font-serif text-3xl font-semibold text-ink">{item.name}</h3>
          {language === "ko" ? (
            <p className="mt-2 text-sm font-semibold text-muted">{item.koreanName}</p>
          ) : null}
          <p className="mt-4 text-sm leading-7 text-ink/68">{item.shortDescription}</p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <I18nText en="View Goods" ko="상품 보기" />
          <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
