import type { Metadata } from "next";
import Link from "next/link";
import { GoogleFormsManager } from "@/components/google-forms/GoogleFormsManager";
import { getGoogleFormsAccess } from "@/lib/googleForms/access";
import { googleFormTemplates } from "@/lib/googleForms/templates";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = createNoIndexMetadata({ title: "Google Forms", description: "K_LINE Google Forms application management.", path: "/admin/google-forms" });

export default async function GoogleFormsAdminPage() {
  const access = await getGoogleFormsAccess();
  if (!access.authenticated || access.manageableClubs.length === 0) return <section className="bg-paper py-20"><div className="mx-auto max-w-3xl px-5"><h1 className="font-serif text-4xl font-semibold text-ink">Google Forms access required</h1><p className="mt-4 text-ink/65">Club administrator or higher access is required.</p><Link href="/" className="mt-6 inline-flex bg-ink px-5 py-3 text-sm font-semibold text-paper">Back to K_LINE</Link></div></section>;
  return <GoogleFormsManager initialAccess={access} templates={googleFormTemplates} />;
}
