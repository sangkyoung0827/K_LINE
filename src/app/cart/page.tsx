import type { Metadata } from "next";
import { CartView } from "@/components/CartView";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Cart",
  description: "Review selected K_LINE cultural goods before proceeding to inquiry checkout.",
  path: "/cart"
});

export default function CartPage() {
  return (
    <section className="bg-paper px-5 py-14 md:px-8 md:py-20">
      <CartView />
    </section>
  );
}
