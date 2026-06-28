import type { Metadata } from "next";
import { EccRejoinRequestForm } from "@/components/EccRejoinRequestForm";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Rejoin ECC",
  description: "Previous ECC members and alumni can request current semester official membership again.",
  path: "/ecc-alumni/rejoin"
});

export default function EccAlumniRejoinPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">ECC Alumni</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">Rejoin ECC</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/64">
          Previous ECC members and alumni can request to become current official ECC members
          again. Official team chat access is restored only after payment confirmation and
          officer approval.
        </p>
        <div className="mt-10">
          <EccRejoinRequestForm />
        </div>
      </div>
    </section>
  );
}
