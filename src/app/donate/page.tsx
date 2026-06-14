import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Donate",
  description: "This donation page now redirects to the ECC fund management page.",
  path: "/donate"
});

export default function DonatePage() {
  redirect("/our-activities/ecc/fund");
}
