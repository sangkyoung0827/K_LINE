import type { Metadata } from "next";
import { CartView } from "@/components/CartView";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review selected K_LINE cultural goods before proceeding to inquiry checkout.",
  openGraph: {
    title: "Cart | K_LINE",
    description: "Inquiry cart for K_LINE Goods. Payment is not connected yet."
  }
};

export default function CartPage() {
  return (
    <section className="bg-paper px-5 py-14 md:px-8 md:py-20">
      <CartView />
    </section>
  );
}
