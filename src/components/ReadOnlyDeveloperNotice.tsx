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
      <I18nText en="Read-only developer: viewing is allowed; saving, deleting and uploads are disabled." ko="읽기 전용 개발자: 화면 조회만 가능하며 저장·삭제·업로드는 차단됩니다." />
    </div>
  );
}
