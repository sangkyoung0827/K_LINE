import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canUseCoDevelopment, labId } from "@/lib/coDevelopment/model";
import { LabOAuthConsent } from "@/components/co-development/LabOAuthConsent";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = createNoIndexMetadata({ title: "Connect Developer Studio | K_LINE", description: "Authorize your development workspace", path: "/co-development/connect" });
export default async function LabConnectPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const params = await searchParams;
  let id: string;
  try { id = labId(params.request); } catch { redirect("/co-development"); }
  const session = await auth();
  if (!canUseCoDevelopment(session?.user?.email)) redirect(`/login?callbackUrl=${encodeURIComponent(`/co-development/connect?request=${id}`)}`);
  return <LabOAuthConsent requestId={id} />;
}
