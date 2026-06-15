import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { DeveloperDashboard } from "@/components/DeveloperDashboard";
import { getAdminAccess } from "@/lib/admin";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Developer",
  description: "K_LINE developer-only analytics console.",
  path: "/developer"
});

export default async function DeveloperPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const access = await getAdminAccess(email);

  if (!session?.user) {
    return (
      <DeveloperGate
        icon={<LockKeyhole aria-hidden className="h-12 w-12 text-brass" />}
        title="Login required"
        description="Google login is required before opening the K_LINE developer console."
        ctaHref="/login"
        ctaLabel="Go to login"
      />
    );
  }

  if (!access.isDeveloper) {
    return (
      <DeveloperGate
        icon={<ShieldCheck aria-hidden className="h-12 w-12 text-brass" />}
        title="Developer access required"
        description={`Current login: ${email}. This page is available only to developer accounts.`}
        ctaHref="/"
        ctaLabel="Back to K_LINE"
      />
    );
  }

  return <DeveloperDashboard />;
}

function DeveloperGate({
  ctaHref,
  ctaLabel,
  description,
  icon,
  title
}: {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="bg-paper py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
        {icon}
        <h1 className="mt-5 font-serif text-5xl font-semibold text-ink">{title}</h1>
        <p className="mt-5 text-base leading-8 text-ink/64">{description}</p>
        <Link
          href={ctaHref}
          className="mt-8 inline-flex min-h-11 items-center justify-center bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
