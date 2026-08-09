import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WoohyukmonV4Shell } from "@/components/WoohyukmonV4Shell";
import { getWoohyukmonV4Access } from "@/lib/woohyukmon-v4-access";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createNoIndexMetadata({
  title: "WooHyukmon 4.0",
  description: "Private developer-only WooHyukmon 4.0 finance control plane.",
  path: "/v4"
});

export default async function WoohyukmonV4Layout({ children }: { children: React.ReactNode }) {
  const access = await getWoohyukmonV4Access();

  if (!access.isAuthenticated) {
    redirect("/login?callbackUrl=/v4");
  }

  if (!access.isDeveloper) {
    redirect("/developer");
  }

  return <WoohyukmonV4Shell>{children}</WoohyukmonV4Shell>;
}

