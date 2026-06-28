import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EccAlumniStatusList } from "@/components/EccAlumniInquiryForm";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "My ECC Alumni Status",
  description: "Logged-in user ECC Alumni inquiry and rejoin request status.",
  path: "/ecc-alumni/status"
});

export default async function EccAlumniStatusPage() {
  const access = await getCurrentEccAccess();

  if (!access.isLoggedIn) {
    redirect("/login?callbackUrl=/ecc-alumni/status");
  }

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">ECC Alumni</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">My Alumni Status</h1>
        <div className="mt-10">
          <EccAlumniStatusList />
        </div>
      </div>
    </section>
  );
}
