import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { MemberRegistrationCampaignForm } from "@/components/MemberRegistrationCampaignForm";
import { hasSuperAdminAccess } from "@/lib/admin";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createNoIndexMetadata({
  title: "New Member Registration Campaign",
  description: "Create a K_LINE Google Form member registration campaign.",
  path: "/admin/member-registrations/new"
});

export default async function NewMemberRegistrationCampaignPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const isSuperAdmin = await hasSuperAdminAccess(email);

  if (!session?.user || !isSuperAdmin) {
    return (
      <section className="bg-paper py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
          <div className="mx-auto flex justify-center">
            {!session?.user ? (
              <LockKeyhole aria-hidden className="h-12 w-12 text-brass" />
            ) : (
              <ShieldCheck aria-hidden className="h-12 w-12 text-brass" />
            )}
          </div>
          <h1 className="mt-5 font-serif text-5xl font-semibold text-ink">
            {!session?.user ? "Login required" : "Super-admin access required"}
          </h1>
          <p className="mt-5 text-base leading-8 text-ink/64">
            Member registration campaigns are available only to super admins.
          </p>
          <Link
            href={!session?.user ? "/login" : "/our-activities/ecc"}
            className="mt-8 inline-flex min-h-11 items-center justify-center bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
          >
            {!session?.user ? "Go to login" : "Back to ECC"}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <Link
          href="/admin/member-registrations"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Back to campaigns
        </Link>
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase text-brass">New campaign</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">
            신규회원 등록 캠페인 만들기
          </h1>
        </div>
        <MemberRegistrationCampaignForm />
      </div>
    </section>
  );
}
