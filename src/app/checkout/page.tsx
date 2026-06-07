import type { Metadata } from "next";
import { InquiryForm } from "@/components/InquiryForm";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "Inquiry Checkout",
  description:
    "Submit an inquiry-based order for K_LINE Goods. Real payment is intentionally not integrated yet.",
  openGraph: {
    title: "Inquiry Checkout | K_LINE",
    description: "Send selected goods, quantity, contact, country, address, and message as an inquiry."
  }
};

export default function CheckoutPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:px-8">
        <SectionHeader
          eyebrow="Inquiry checkout"
          title="Send the order inquiry first"
          description="K_LINE does not connect real payment yet. This form stores the inquiry locally and marks the future connection point for backend, email, database, and payment requests."
        />
        <InquiryForm mode="checkout" title="Order Inquiry Form" />
      </div>
    </section>
  );
}
