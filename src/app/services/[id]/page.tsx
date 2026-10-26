import Link from "next/link";
import { notFound } from "next/navigation";
import { labPublicRevision } from "@/lib/coDevelopment/server";
import { LabError } from "@/lib/coDevelopment/model";
import { ScopedPreview } from "@/components/co-development/ScopedPreview";
export const dynamic = "force-dynamic";
export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let service;
  try { service = await labPublicRevision(id); } catch (e) { if (e instanceof LabError && (e.status === 404 || e.code === "INVALID_ID")) notFound(); throw e; }
  return <main className="mx-auto max-w-7xl space-y-4 px-4 py-6"><Link href="/" className="text-sm underline">K_LINE</Link><h1 className="break-words text-2xl font-semibold">{service.title}</h1><ScopedPreview id={id} /></main>;
}
