import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { EccAlumniInquiryAdminPanel } from "@/components/EccAlumniAdminPanels";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Alumni Activity Inquiries Admin",
  description: "Admin-only ECC Alumni activity inquiry management.",
  path: "/admin/ecc-alumni/inquiries"
});

export default async function AdminEccAlumniInquiriesPage() {
  const access = await getCurrentEccAccess();

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">Admin / ECC Alumni</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">Activity Inquiries</h1>
        <div className="mt-10">
          {access.isAdmin ? (
            <EccAlumniInquiryAdminPanel />
          ) : (
            <div className="paper-panel flex gap-4 p-6">
              <Lock aria-hidden className="h-5 w-5" />
              Admin access required.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
