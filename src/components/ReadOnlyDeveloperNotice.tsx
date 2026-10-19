"use client";

import { useSession } from "next-auth/react";
import { Eye } from "lucide-react";
import { isReadOnlyDeveloperEmail } from "@/lib/readOnlyDeveloper";
import { I18nText } from "@/components/LanguageProvider";

export function useReadOnlyDeveloper() {
  const { data } = useSession();
  return isReadOnlyDeveloperEmail(data?.user?.email);
}

export function ReadOnlyDeveloperNotice() {
  if (!useReadOnlyDeveloper()) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-ink/15 bg-white px-4 py-3 text-center text-sm text-ink">
      <Eye aria-hidden className="h-4 w-4 shrink-0" />
      <I18nText en="Production is read-only. Prototypes can be saved in the Co-development Lab." ko="운영 화면은 조회 전용입니다. 시험 기능은 공동개발실에서 저장할 수 있습니다." />
    </div>
  );
}
