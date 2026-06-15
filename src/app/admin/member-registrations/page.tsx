import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { MemberRegistrationManager } from "@/components/MemberRegistrationManager";
import { hasSuperAdminAccess } from "@/lib/admin";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Member Registration Manager",
  description: "Super-admin-only K_LINE member registration campaign manager.",
  path: "/admin/member-registrations"
});

export default async function MemberRegistrationsAdminPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const isSuperAdmin = await hasSuperAdminAccess(email);

  if (!session?.user) {
    return (
      <AccessGate
        title="Login required"
        description="Google login is required before opening member registration management."
        href="/login"
        label="Go to login"
        icon={<LockKeyhole aria-hidden className="h-12 w-12 text-brass" />}
      />
    );
  }

  if (!isSuperAdmin) {
    return (
      <AccessGate
        title="Super-admin access required"
        description={`Current login: ${email}. Member registration management is available only to super admins.`}
        href="/our-activities/ecc"
        label="Back to ECC"
        icon={<ShieldCheck aria-hidden className="h-12 w-12 text-brass" />}
      />
    );
  }

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase text-brass">Admin / member registrations</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">
            신규회원 등록 관리
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/64">
            Create Google Form registration campaigns, share QR codes, import response CSVs, and manage
            applicant status from one place.
          </p>
        </div>
        <MemberRegistrationManager />
      </div>
    </section>
  );
}

function AccessGate({
  description,
  href,
  icon,
  label,
  title
}: {
  description: string;
  href: string;
  icon: ReactNode;
  label: string;
  title: string;
}) {
  return (
    <section className="bg-paper py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
        <div className="mx-auto flex justify-center">{icon}</div>
        <h1 className="mt-5 font-serif text-5xl font-semibold text-ink">{title}</h1>
        <p className="mt-5 text-base leading-8 text-ink/64">{description}</p>
        <Link
          href={href}
          className="mt-8 inline-flex min-h-11 items-center justify-center bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
        >
          {label}
        </Link>
      </div>
    </section>
  );
}
