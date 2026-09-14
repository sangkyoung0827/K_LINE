import { SiuPlatform } from "@/components/social-impact-union/SiuPlatform";
import { createNoIndexMetadata } from "@/lib/seo";
export const metadata = createNoIndexMetadata({ title: "SIU Management", description: "Social Impact Union activities on K_LINE.", path: "/social-impact-union/admin" });
export default function Page() { return <SiuPlatform mode="admin" />; }
