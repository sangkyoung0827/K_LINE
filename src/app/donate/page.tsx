import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Donate",
  description: "This donation page now redirects to the ECC fund management page."
};

export default function DonatePage() {
  redirect("/our-activities/ecc/fund");
}
