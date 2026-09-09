import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HanhwalAlumniStatusList } from "@/components/HanhwalAlumniInquiryForm";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "My HANHWAL Alumni Status",
  description: "Logged-in user HANHWAL Alumni inquiry and rejoin request status.",
  path: "/hanhwal-alumni/status"
});

export default async function HanhwalAlumniStatusPage() {
  const access = await getCurrentHanhwalAccess();

  if (!access.isLoggedIn) {
    redirect("/login?callbackUrl=/hanhwal-alumni/status");
  }

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">HANHWAL Alumni</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">My Alumni Status</h1>
        <div className="mt-10">
          <HanhwalAlumniStatusList />
        </div>
      </div>
    </section>
  );
}
