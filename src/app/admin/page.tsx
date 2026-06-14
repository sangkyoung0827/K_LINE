import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { AdminDashboard } from "@/components/AdminDashboard";
import { auth } from "@/auth";
import { getAdminAccess, getSuperAdminEmails } from "@/lib/admin";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Admin",
  description: "K_LINE super admin console.",
  path: "/admin"
});

export default async function AdminPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? email ?? "K_LINE admin";
  const configuredAdmins = getSuperAdminEmails();
  const access = await getAdminAccess(email);

  if (!session?.user) {
    return (
      <AdminGate
        icon={<LockKeyhole aria-hidden className="h-12 w-12 text-brass" />}
        title="Login required"
        description="Google login is required before opening the K_LINE admin console."
        ctaHref="/login"
        ctaLabel="Go to login"
      />
    );
  }

  if (!access.isSuperAdmin) {
    return (
      <AdminGate
        icon={<ShieldCheck aria-hidden className="h-12 w-12 text-brass" />}
        title="Super admin access required"
        description={
          configuredAdmins.length > 0
            ? `Current login: ${email}. This email is not registered as a super admin.`
            : `Current login: ${email}. SUPER_ADMIN_EMAILS is not configured yet.`
        }
        ctaHref="/"
        ctaLabel="Back to K_LINE"
      />
    );
  }

  return <AdminDashboard adminEmail={email} adminName={name} />;
}

function AdminGate({
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
