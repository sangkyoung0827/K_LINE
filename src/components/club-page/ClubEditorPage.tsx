import Link from "next/link";
import { redirect } from "next/navigation";
import type { ClubKey } from "@/types/club-page";
import { CLUB_PAGE_CONFIG } from "@/lib/club-page/config";
import { getClubWebsiteAccess } from "@/lib/club-page/access";
import { ClubWebsiteEditor } from "./ClubWebsiteEditor";

export async function ClubEditorPage({ clubKey }: { clubKey: ClubKey }) {
  const access = await getClubWebsiteAccess(clubKey);
  const config = CLUB_PAGE_CONFIG[clubKey];
  if (!access.isLoggedIn) redirect(`/login?callbackUrl=${encodeURIComponent(config.editPath)}`);
  if (!access.isAdmin) return <section className="mx-auto max-w-3xl px-5 py-16"><h1 className="text-2xl font-semibold">해당 동아리 관리자 권한이 필요합니다.</h1><Link className="mt-6 inline-block underline" href={config.officialPath}>돌아가기</Link></section>;
  return <ClubWebsiteEditor clubKey={clubKey} />;
}
