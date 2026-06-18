import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC New Member Registration",
  description: "Private ECC new member registration shortcut.",
  path: "/ecc-join"
});

export default function EccJoinPage() {
  redirect("/our-activities/ecc/register");
}
