import type { Metadata } from "next";
import { InquiryForm } from "@/components/InquiryForm";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { requirePrivilegedAccess } from "@/lib/privilegedAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Inquiry Checkout",
  description:
    "Submit an inquiry-based order for K_LINE Goods. Real payment is intentionally not integrated yet.",
  path: "/checkout"
});

export default async function CheckoutPage() {
  await requirePrivilegedAccess();

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:px-8">
        <SectionHeader
          eyebrow={<I18nText en="Inquiry checkout" ko="문의 체크아웃" />}
          title={<I18nText en="Send the order inquiry first" ko="먼저 주문 문의를 보내세요" />}
          description={
            <I18nText
              en="K_LINE does not connect real payment yet. This form stores the inquiry locally and marks the future connection point for backend, email, database, and payment requests."
              ko="K_LINE은 아직 실제 결제를 연결하지 않았습니다. 이 양식은 문의를 저장하고 향후 백엔드, 이메일, 데이터베이스, 결제 요청 연결 지점을 표시합니다."
            />
          }
        />
        <InquiryForm mode="checkout" title="Order Inquiry Form" />
      </div>
    </section>
  );
}
