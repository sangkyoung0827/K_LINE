import { ClubWebsitePage } from "@/components/club-page/ClubWebsitePage";
export const metadata = {
  title: "ECC Club Website",
  description: "ECC public club website on K_LINE.",
  alternates: { canonical: "/clubs/ecc" },
};
export const dynamic = "force-dynamic";
export default function Page() {
  return <ClubWebsitePage clubKey="ecc" />;
}
