"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { GoodsItem } from "@/types";
import { useCart } from "@/components/CartProvider";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

export function GoodsCard({ item }: { item: GoodsItem }) {
  const { addItem } = useCart();
  const { language } = useLanguage();

  return (
    <article className="paper-panel grid overflow-hidden">
      <Link href={`/goods/${item.slug}`} className="relative aspect-[4/3] overflow-hidden bg-hanji">
        <Image
          src={item.images[0].src}
          alt={item.images[0].alt}
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover transition duration-500 hover:scale-105"
        />
      </Link>
      <div className="grid gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase text-brass">
            {language === "ko" ? "문화 상품" : item.category}
          </p>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{item.name}</h3>
          {language === "ko" ? <p className="mt-1 text-sm text-ink/62">{item.koreanName}</p> : null}
        </div>
        <p className="text-sm leading-7 text-ink/70">{item.shortDescription}</p>
        <p className="text-sm font-semibold text-ink">{item.pricePlaceholder}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/goods/${item.slug}`}
            className="inline-flex min-h-10 items-center justify-center border border-ink/18 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
          >
            <I18nText en="View Details" ko="자세히 보기" />
          </Link>
          <button
            type="button"
            onClick={() => addItem(item)}
            className="inline-flex min-h-10 items-center justify-center gap-2 bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-navy"
          >
            <ShoppingBag aria-hidden className="h-4 w-4" />
            <I18nText en="Add to Cart" ko="장바구니 담기" />
          </button>
        </div>
      </div>
    </article>
  );
}
