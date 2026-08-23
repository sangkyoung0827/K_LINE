import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "ECC",
  description:
    "ECC is the English Conversation Club at Jeonbuk National University. K_LINE supports ECC registration, official member access, activities, and international student community features.",
  path: "/our-activities/ecc",
  keywords: [
    "ECC",
    "English Conversation Club",
    "Jeonbuk National University",
    "JBNU",
    "international students",
    "campus culture",
    "student activities",
    "official member registration"
  ]
});

export default async function EccHubPage() {
  const access = await getCurrentEccAccess();

  if (access.isOfficialMember) {
    redirect("/ecc-official");
  }

  return (
    <section className="bg-paper py-10 sm:py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <h1 className="font-serif text-4xl font-semibold text-navy sm:text-5xl md:text-7xl">ECC</h1>

        <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-5 shadow-soft sm:mt-10 sm:p-8 md:p-10">
          <h2 className="font-serif text-2xl font-semibold text-navy sm:text-3xl md:text-4xl">
            신규 회원 등록
          </h2>

          <Link
            href="/ecc-join"
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-navy px-6 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-navy/90 sm:mt-8"
          >
            등록하기
          </Link>
        </div>
      </div>
    </section>
  );
}
