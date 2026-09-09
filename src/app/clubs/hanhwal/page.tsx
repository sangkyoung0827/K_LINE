import { ClubWebsitePage } from "@/components/club-page/ClubWebsitePage";
export const metadata = {
  title: "Hanhwal Club Website",
  description: "Hanhwal public club website on K_LINE.",
  alternates: { canonical: "/clubs/hanhwal" },
};
export const dynamic = "force-dynamic";
export default function Page() {
  return <ClubWebsitePage clubKey="hanhwal" />;
}
