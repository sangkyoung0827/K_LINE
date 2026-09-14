import { SiuPlatform } from "@/components/social-impact-union/SiuPlatform";
import { createNoIndexMetadata } from "@/lib/seo";
export const metadata = createNoIndexMetadata({ title: "Create SIU Activity", description: "Social Impact Union activities on K_LINE.", path: "/social-impact-union/activities/create" });
export default function Page() { return <SiuPlatform mode="create" />; }
