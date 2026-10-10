import { EventStudio } from "@/components/google-forms/EventStudio";
import { getStudioAccess } from "@/lib/eventStudio/access";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = createNoIndexMetadata({ title: "Event Studio", description: "K_LINE administrator event drafts", path: "/admin/event-studio" });
export default async function EventStudioPage() {
  try {
    const access = await getStudioAccess();
    if (!access.manageableClubs.length) return <p className="p-8">클럽 관리자 권한이 필요합니다. / Club administrator access required.</p>;
    return <EventStudio />;
  } catch { return <p className="p-8">로그인과 관리자 권한을 확인해주세요. / Check your administrator account.</p>; }
}
