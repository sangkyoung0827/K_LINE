import Link from "next/link";
import { Globe2 } from "lucide-react";
import type { ClubDocument, ClubKey } from "@/types/club-page";
import { CLUB_PAGE_CONFIG } from "@/lib/club-page/config";
import { getPublishedClubPage } from "@/lib/club-page/server";
import { ClubWebsiteRenderer } from "./ClubWebsiteRenderer";
import styles from "./club-page.module.css";

export async function ClubWebsitePage({ clubKey }: { clubKey: ClubKey }) {
  let document: ClubDocument | null = null;
  let failed = false;
  try {
    document = await getPublishedClubPage(clubKey);
  } catch {
    failed = true;
  }
  if (!document)
    return (
      <div className={`${styles.builder} ${styles.empty}`}>
        <Globe2 size={36} />
        <h1>{CLUB_PAGE_CONFIG[clubKey].label}</h1>
        <p>
          {failed
            ? "웹사이트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
            : "웹사이트 준비 중"}
        </p>
        <Link href="/">K_LINE</Link>
      </div>
    );
  return <ClubWebsiteRenderer document={document} />;
}
