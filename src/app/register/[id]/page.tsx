import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicMemberRegistrationLanding } from "@/components/PublicMemberRegistrationLanding";
import { getPublicMemberRegistrationCampaign } from "@/lib/memberRegistrations";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = createNoIndexMetadata({
  title: "Member Registration",
  description: "K_LINE member registration guide page.",
  path: "/register"
});

export default async function PublicMemberRegistrationPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const campaign = await getPublicMemberRegistrationCampaign(id);

    if (!campaign) {
      notFound();
    }

    return <PublicMemberRegistrationLanding campaign={campaign} />;
  } catch {
    notFound();
  }
}
