import { notFound } from "next/navigation";
import { EccGoogleFormEntry } from "@/components/google-forms/EccGoogleFormEntry";
import { assertEccResponderGate } from "@/lib/googleForms/eccResponderEntry";

export const dynamic = "force-dynamic";
export const metadata = { title: "ECC Activity Application", robots: { index: false, follow: false } };

export default async function EccFormEntryPage({ params }: { params: Promise<{ id: string }> }) {
  try { assertEccResponderGate(); } catch { notFound(); }
  const { id } = await params;
  return <EccGoogleFormEntry id={id} />;
}
