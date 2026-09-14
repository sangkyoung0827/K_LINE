import { SiuPlatform } from "@/components/social-impact-union/SiuPlatform";
import { notFound } from "next/navigation";
export const metadata = { title: "SIU Activity", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <SiuPlatform mode="detail" id={id} />;
}
