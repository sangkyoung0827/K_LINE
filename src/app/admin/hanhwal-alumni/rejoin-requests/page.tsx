import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { HanhwalRejoinRequestAdminPanel } from "@/components/HanhwalAlumniAdminPanels";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "HANHWAL Rejoin Requests Admin",
  description: "Admin-only HANHWAL rejoin request management.",
  path: "/admin/hanhwal-alumni/rejoin-requests"
});

export default async function AdminHanhwalRejoinRequestsPage() {
  const access = await getCurrentHanhwalAccess();

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">Admin / HANHWAL Alumni</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">Rejoin Requests</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/64">
          Approving a rejoin request after payment confirmation restores current official HANHWAL
          member access. The official team chat link remains protected until approval.
        </p>
        <div className="mt-10">
          {access.isAdmin ? (
            <HanhwalRejoinRequestAdminPanel />
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
