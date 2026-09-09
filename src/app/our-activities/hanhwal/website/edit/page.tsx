import { ClubEditorPage } from "@/components/club-page/ClubEditorPage";
import { createNoIndexMetadata } from "@/lib/seo";
export const metadata = createNoIndexMetadata({ title: "Hanhwal Website Builder", description: "K_LINE Club Website Builder", path: "/our-activities/hanhwal/website/edit" });
export const dynamic = "force-dynamic";
export default function Page() { return <ClubEditorPage clubKey="hanhwal" />; }

