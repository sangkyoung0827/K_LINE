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
    <section className="bg-paper py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <h1 className="font-serif text-5xl font-semibold text-navy md:text-7xl">ECC</h1>

        <div className="mt-10 rounded-[2rem] border border-navy/10 bg-white p-8 shadow-soft md:p-10">
          <h2 className="font-serif text-3xl font-semibold text-navy md:text-4xl">
            신규 회원 등록
          </h2>

          <Link
            href="/ecc-join"
            className="mt-8 inline-flex rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-navy/90"
          >
            등록하기
          </Link>
        </div>
      </div>
    </section>
  );
}
