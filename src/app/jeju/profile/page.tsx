import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "My Journey Profile",
  description: "Private My Journey food, allergy, activity, and budget preferences.",
  path: "/jeju/profile"
});

export default function JejuProfilePage() {
  redirect("/jeju");
}
