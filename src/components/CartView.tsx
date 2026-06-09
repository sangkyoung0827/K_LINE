"use client";

import Link from "next/link";
import { CTAButton } from "@/components/CTAButton";
import { CartItem } from "@/components/CartItem";
import { useCart } from "@/components/CartProvider";
import { I18nText } from "@/components/LanguageProvider";

export function CartView() {
  const { items, estimatedTotalEur, totalQuantity, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="paper-panel mx-auto max-w-3xl p-8 text-center">
        <h1 className="font-serif text-4xl font-semibold text-ink">
          <I18nText en="Cart" ko="장바구니" />
        </h1>
        <p className="mt-4 text-ink/68">
          <I18nText en="Your K_LINE inquiry cart is empty." ko="K_LINE 문의 장바구니가 비어 있습니다." />
        </p>
        <div className="mt-6">
          <CTAButton href="/goods">
            <I18nText en="Shop Goods" ko="상품 보기" />
          </CTAButton>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_340px]">
      <div className="paper-panel p-5 md:p-8">
        <h1 className="font-serif text-4xl font-semibold text-ink">
          <I18nText en="Cart" ko="장바구니" />
        </h1>
        <p className="mt-3 text-sm text-ink/68">
          <I18nText
            en="Review selected goods before sending an inquiry. Payment is not connected yet."
            ko="문의 전 선택한 상품을 확인하세요. 실제 결제는 아직 연결되지 않았습니다."
          />
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
        <h2 className="font-serif text-2xl font-semibold text-ink">
          <I18nText en="Inquiry Summary" ko="문의 요약" />
        </h2>
        <dl className="mt-5 grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink/62">
              <I18nText en="Items" ko="상품 수" />
            </dt>
            <dd className="font-semibold text-ink">{totalQuantity}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink/62">
              <I18nText en="Estimated total" ko="예상 합계" />
            </dt>
            <dd className="font-semibold text-ink">EUR {estimatedTotalEur}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-6 text-ink/58">
          <I18nText
            en="The total is a placeholder estimate for inquiry planning. Real payment and inventory confirmation should be connected later."
            ko="합계는 문의 계획을 위한 임시 예상 금액입니다. 실제 결제와 재고 확인은 이후 연결되어야 합니다."
          />
        </p>
        <div className="mt-6 grid gap-3">
          <CTAButton href="/checkout">
            <I18nText en="Proceed to Inquiry Checkout" ko="문의 체크아웃으로 이동" />
          </CTAButton>
          <Link href="/goods" className="text-center text-sm font-semibold text-ink underline underline-offset-4">
            <I18nText en="Continue shopping" ko="계속 둘러보기" />
          </Link>
        </div>
      </aside>
    </div>
  );
}
