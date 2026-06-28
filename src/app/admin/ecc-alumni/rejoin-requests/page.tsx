import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { EccRejoinRequestAdminPanel } from "@/components/EccAlumniAdminPanels";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Rejoin Requests Admin",
  description: "Admin-only ECC rejoin request management.",
  path: "/admin/ecc-alumni/rejoin-requests"
});

export default async function AdminEccRejoinRequestsPage() {
  const access = await getCurrentEccAccess();

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">Admin / ECC Alumni</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">Rejoin Requests</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/64">
          Approving a rejoin request after payment confirmation restores current official ECC
          member access. The official team chat link remains protected until approval.
        </p>
        <div className="mt-10">
          {access.isAdmin ? (
            <EccRejoinRequestAdminPanel />
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
