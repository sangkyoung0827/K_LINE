import type { Metadata } from "next";
import { HanhwalRejoinRequestForm } from "@/components/HanhwalRejoinRequestForm";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Rejoin HANHWAL",
  description: "Previous HANHWAL members and alumni can request current semester official membership again.",
  path: "/hanhwal-alumni/rejoin"
});

export default function HanhwalAlumniRejoinPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">HANHWAL Alumni</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">Rejoin HANHWAL</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/64">
          Previous HANHWAL members and alumni can request to become current official HANHWAL members
          again. Official team chat access is restored only after payment confirmation and
          officer approval.
        </p>
        <div className="mt-10">
          <HanhwalRejoinRequestForm />
        </div>
      </div>
    </section>
  );
}
