"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartLine } from "@/types";

type CartItemProps = {
  item: CartLine;
  updateQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
};

export function CartItem({ item, updateQuantity, removeItem }: CartItemProps) {
  return (
    <article className="grid gap-4 border-b border-ink/10 py-5 sm:grid-cols-[132px_1fr_auto]">
      <Link href={`/goods/${item.slug}`} className="relative aspect-[4/3] overflow-hidden bg-hanji">
        <Image src={item.image.src} alt={item.image.alt} fill sizes="132px" className="object-cover" />
      </Link>
      <div>
        <h2 className="font-serif text-2xl font-semibold text-ink">{item.name}</h2>
        <p className="mt-1 text-sm text-ink/62">{item.koreanName}</p>
        <p className="mt-3 text-sm text-ink/70">{item.pricePlaceholder}</p>
        <p className="mt-2 text-sm font-semibold text-ink">
          Estimated line total: EUR {item.estimatedPriceEur * item.quantity}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={() => updateQuantity(item.slug, item.quantity - 1)}
          className="flex h-10 w-10 items-center justify-center border border-ink/12 hover:bg-brass/10"
        >
          <Minus aria-hidden className="h-4 w-4" />
        </button>
        <span className="w-10 text-center text-sm font-semibold">{item.quantity}</span>
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => updateQuantity(item.slug, item.quantity + 1)}
          className="flex h-10 w-10 items-center justify-center border border-ink/12 hover:bg-brass/10"
        >
          <Plus aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Remove item"
          onClick={() => removeItem(item.slug)}
          className="flex h-10 w-10 items-center justify-center border border-ink/12 text-ink hover:border-red-500 hover:text-red-600"
        >
          <Trash2 aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
