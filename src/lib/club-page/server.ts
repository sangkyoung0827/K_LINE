import "server-only";
import {
  getSupabaseConfig,
  supabaseRequest,
  SupabaseRequestError,
} from "@/lib/supabaseServer";
import type { ClubDocument, ClubDraft, ClubKey } from "@/types/club-page";
import { ClubPageError, validateDocument } from "./validation";

export async function getPublishedClubPage(
  club: ClubKey,
): Promise<ClubDocument | null> {
  const rows = await supabaseRequest<
    { published_theme_id: string; published_sections: unknown }[]
  >(
    `club_pages?club_key=eq.${club}&is_published=eq.true&select=published_theme_id,published_sections&limit=1`,
    { cache: "no-store", signal: AbortSignal.timeout(5000) },
  );
  return rows[0]
    ? validateDocument(
        {
          themeId: rows[0].published_theme_id,
          sections: rows[0].published_sections,
        },
        club,
        getSupabaseConfig().url,
      )
    : null;
}
export async function isClubWebsitePublished(club: ClubKey) {
  try {
    const rows = await supabaseRequest<{ club_key: string }[]>(
      `club_pages?club_key=eq.${club}&is_published=eq.true&select=club_key&limit=1`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    return rows.length > 0;
  } catch {
    return false;
  } // A missing migration must not break the existing official lounge.
}
export async function getClubDraft(club: ClubKey): Promise<ClubDraft> {
  const rows = await supabaseRequest<
    {
      draft_theme_id: string;
      draft_sections: unknown;
      revision: number;
      is_published: boolean;
    }[]
  >(
    `club_pages?club_key=eq.${club}&select=draft_theme_id,draft_sections,revision,is_published&limit=1`,
    { cache: "no-store" },
  );
  if (!rows[0])
    throw new ClubPageError("웹사이트 DB 초기 설정이 필요합니다.", 503);
  return {
    ...validateDocument(
      { themeId: rows[0].draft_theme_id, sections: rows[0].draft_sections },
      club,
      getSupabaseConfig().url,
    ),
    revision: rows[0].revision,
    isPublished: rows[0].is_published,
  };
}
export async function writeClubPage(
  club: ClubKey,
  document: ClubDocument,
  revision: number,
  action: "draft" | "publish" | "unpublish",
  email: string,
) {
  const validated = validateDocument(document, club, getSupabaseConfig().url);
  try {
    return await supabaseRequest<number>("rpc/write_club_page", {
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({
        target_club: club,
        expected_revision: revision,
        action,
        theme: validated.themeId,
        sections: validated.sections,
        actor: email,
      }),
    });
  } catch (error) {
    if (
      error instanceof SupabaseRequestError &&
      error.message.includes("CLUB_PAGE_CONFLICT")
    ) {
      throw new ClubPageError(
        "다른 관리자가 변경했습니다. 현재 입력은 유지됩니다. 새로 불러온 후 다시 저장해 주세요.",
        409,
      );
    }
    throw error;
  }
}
