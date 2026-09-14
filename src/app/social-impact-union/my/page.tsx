import { SiuPlatform } from "@/components/social-impact-union/SiuPlatform";
import { createNoIndexMetadata } from "@/lib/seo";
export const metadata = createNoIndexMetadata({ title: "My SIU Activities", description: "Social Impact Union activities on K_LINE.", path: "/social-impact-union/my" });
export default function Page() { return <SiuPlatform mode="my" />; }
