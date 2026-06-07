"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import type { GoodsItem } from "@/types";
import { useCart } from "@/components/CartProvider";
import { CTAButton } from "@/components/CTAButton";

export function GoodsDetail({ item }: { item: GoodsItem }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  const add = () => {
    addItem(item, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  };

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[1fr_0.9fr] md:px-8">
        <div className="relative aspect-[4/3] overflow-hidden bg-hanji shadow-soft">
          <Image
            src={item.images[0].src}
            alt={item.images[0].alt}
            fill
            priority
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-cover"
          />
        </div>

        <div className="grid content-start gap-7">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">{item.category}</p>
            <h1 className="mt-3 font-serif text-4xl font-semibold text-ink md:text-6xl">
              {item.name}
            </h1>
            <p className="mt-2 text-lg text-ink/62">{item.koreanName}</p>
          </div>

          <p className="text-base leading-8 text-ink/72">{item.fullDescription}</p>
          <p className="text-lg font-semibold text-ink">{item.pricePlaceholder}</p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex h-12 items-center border border-ink/18 bg-white/60">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="flex h-12 w-12 items-center justify-center hover:bg-brass/10"
              >
                <Minus aria-hidden className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-sm font-semibold">{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity((value) => value + 1)}
                className="flex h-12 w-12 items-center justify-center hover:bg-brass/10"
              >
                <Plus aria-hidden className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={add}
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
            >
              <ShoppingBag aria-hidden className="h-4 w-4" />
              Add to Cart
            </button>
            <CTAButton href="/contact" variant="outline">
              Inquiry
            </CTAButton>
          </div>

          {added ? <p className="text-sm font-semibold text-pine">Added to cart.</p> : null}

          <div className="grid gap-5 border-t border-ink/12 pt-7">
            <InfoBlock title="Product Story" items={[item.story]} />
            <InfoBlock
              title="Specification"
              items={Object.entries(item.specifications).map(([key, value]) => `${key}: ${value}`)}
            />
            <InfoBlock title="Materials" items={item.materials} />
            <InfoBlock title="Use Cases" items={item.useCases} />
          </div>

          <Link href="/goods" className="text-sm font-semibold text-ink underline underline-offset-4">
            Back to Goods
          </Link>
        </div>
      </div>
    </section>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase text-ink">{title}</h2>
      <ul className="mt-3 grid gap-2 text-sm leading-7 text-ink/70">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
