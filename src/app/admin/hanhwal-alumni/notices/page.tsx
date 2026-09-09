import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { HanhwalAlumniNoticeAdminPanel } from "@/components/HanhwalAlumniAdminPanels";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "HANHWAL Alumni Notices Admin",
  description: "Admin-only HANHWAL Alumni notice management.",
  path: "/admin/hanhwal-alumni/notices"
});

export default async function AdminHanhwalAlumniNoticesPage() {
  const access = await getCurrentHanhwalAccess();

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">Admin / HANHWAL Alumni</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">Manage Alumni Notices</h1>
        <div className="mt-10">
          {access.isAdmin ? (
            <HanhwalAlumniNoticeAdminPanel />
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
