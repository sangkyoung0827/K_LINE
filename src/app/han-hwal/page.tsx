import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Han-hwal Redirect",
  description: "Redirects to the K_LINE Han-hwal page.",
  path: "/han-hwal"
});

export default function HanHwalRedirectPage() {
  permanentRedirect("/our-activities/hanhwal");
}
