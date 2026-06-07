"use client";

import Link from "next/link";
import { CTAButton } from "@/components/CTAButton";
import { CartItem } from "@/components/CartItem";
import { useCart } from "@/components/CartProvider";

export function CartView() {
  const { items, estimatedTotalEur, totalQuantity, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="paper-panel mx-auto max-w-3xl p-8 text-center">
        <h1 className="font-serif text-4xl font-semibold text-ink">Cart</h1>
        <p className="mt-4 text-ink/68">Your K_LINE inquiry cart is empty.</p>
        <div className="mt-6">
          <CTAButton href="/goods">Shop Goods</CTAButton>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_340px]">
      <div className="paper-panel p-5 md:p-8">
        <h1 className="font-serif text-4xl font-semibold text-ink">Cart</h1>
        <p className="mt-3 text-sm text-ink/68">
          Review selected goods before sending an inquiry. Payment is not connected yet.
        </p>
        <div className="mt-5">
          {items.map((item) => (
            <CartItem
              key={item.slug}
              item={item}
              updateQuantity={updateQuantity}
              removeItem={removeItem}
            />
          ))}
        </div>
      </div>
      <aside className="paper-panel h-fit p-6">
        <h2 className="font-serif text-2xl font-semibold text-ink">Inquiry Summary</h2>
        <dl className="mt-5 grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink/62">Items</dt>
            <dd className="font-semibold text-ink">{totalQuantity}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink/62">Estimated total</dt>
            <dd className="font-semibold text-ink">EUR {estimatedTotalEur}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-6 text-ink/58">
          The total is a placeholder estimate for inquiry planning. Real payment and inventory
          confirmation should be connected later.
        </p>
        <div className="mt-6 grid gap-3">
          <CTAButton href="/checkout">Proceed to Inquiry Checkout</CTAButton>
          <Link href="/goods" className="text-center text-sm font-semibold text-ink underline underline-offset-4">
            Continue shopping
          </Link>
        </div>
      </aside>
    </div>
  );
}
