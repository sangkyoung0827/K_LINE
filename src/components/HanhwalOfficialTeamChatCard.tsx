"use client";

import { Edit3, Loader2, MessageCircle, Save, X } from "lucide-react";
import { useState } from "react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import { useReadOnlyDeveloper } from "@/components/ReadOnlyDeveloperNotice";

type Props = {
  initialPeriodLabel: string;
  initialTeamChatUrl: string;
  initialDescriptionKo?: string;
  initialDescriptionEn?: string;
  isAdmin: boolean;
};

type OperationsResponse = {
  error?: string;
  settings?: {
    officialTeamChatUrl: string;
    periodLabel: string;
    teamChatDescriptionKo: string;
    teamChatDescriptionEn: string;
  };
};

export function HanhwalOfficialTeamChatCard({
  initialPeriodLabel,
  initialTeamChatUrl,
  initialDescriptionKo = "등록한 이름 또는 카카오톡 표시 이름으로 입장해 주세요.",
  initialDescriptionEn = "Please join using your registered name or KakaoTalk display name.",
  isAdmin: adminAccess
}: Props) {
  const readOnly = useReadOnlyDeveloper();
  const isAdmin = adminAccess && !readOnly;
  const { language } = useLanguage();
  const korean = language === "ko";
  const [teamChatUrl, setTeamChatUrl] = useState(initialTeamChatUrl);
  const [periodLabel, setPeriodLabel] = useState(initialPeriodLabel);
  const [draftUrl, setDraftUrl] = useState(initialTeamChatUrl);
  const [draftPeriodLabel, setDraftPeriodLabel] = useState(initialPeriodLabel);
  const [description, setDescription] = useState({ ko: initialDescriptionKo, en: initialDescriptionEn });
  const [draftDescription, setDraftDescription] = useState({ ko: initialDescriptionKo, en: initialDescriptionEn });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [qrVersion, setQrVersion] = useState(0);

  const beginEditing = () => {
    if (!isAdmin) return;
    setDraftUrl(teamChatUrl);
    setDraftPeriodLabel(periodLabel);
    setDraftDescription(description);
    setError("");
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/hanhwal/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officialTeamChatUrl: draftUrl,
          periodLabel: draftPeriodLabel,
          teamChatDescriptionKo: draftDescription.ko,
          teamChatDescriptionEn: draftDescription.en
        })
      });
      const data = (await response.json()) as OperationsResponse;

      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Hanhwal team chat settings could not be saved.");
      }

      setTeamChatUrl(data.settings.officialTeamChatUrl);
      setPeriodLabel(data.settings.periodLabel);
      setDraftUrl(data.settings.officialTeamChatUrl);
      setDraftPeriodLabel(data.settings.periodLabel);
      const nextDescription = { ko: data.settings.teamChatDescriptionKo, en: data.settings.teamChatDescriptionEn };
      setDescription(nextDescription);
      setDraftDescription(nextDescription);
      setQrVersion((value) => value + 1);
      setEditing(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Hanhwal team chat settings could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`paper-panel mx-auto grid w-full max-w-5xl justify-items-center text-center ${
        !editing
          ? "max-md:rounded-none max-md:border-0 max-md:bg-transparent p-0 md:p-10"
          : "p-4 sm:p-6 md:p-10"
      }`}
    >
      {!editing ? (
        <>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 border border-pine/20 bg-pine/10 px-3 py-2 text-xs font-semibold uppercase text-pine">
              <I18nText en="Confirmed member" ko="정식회원 확인됨" />
            </div>
            {periodLabel ? (
              <p className="mt-4 text-xs font-semibold uppercase text-brass">{periodLabel}</p>
            ) : null}
            <h2 className="mt-4 font-serif text-xl font-semibold text-ink sm:text-2xl">
              <I18nText en="Join the Hanhwal team chat" ko="한활 팀채팅에 입장하세요" />
            </h2>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-ink/66">
              {description[language]}
            </p>
          </div>

          <div className="flex w-full items-center gap-3 md:mt-6 md:grid md:max-w-60">
            <img
              key={qrVersion}
              src={`/api/hanhwal/official-team-qr?v=${qrVersion}`}
              alt="Hanhwal official team chat QR code"
              className="hidden aspect-square w-full border border-ink/10 bg-white object-contain p-3 md:block"
            />
            <a
              href={teamChatUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy max-md:min-w-0 max-md:rounded-lg max-md:py-3"
            >
              <MessageCircle aria-hidden className="h-4 w-4" />
              <I18nText en="Join Hanhwal Official Team Chat" ko="한활 공식 팀채팅 입장" />
            </a>
            {isAdmin ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  beginEditing();
                }}
                aria-label={korean ? "팀채팅 정보 수정" : "Edit team chat"}
                title={korean ? "팀채팅 정보 수정" : "Edit team chat"}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center justify-self-center rounded-lg border border-ink/15 bg-white/65 text-ink"
              >
                <Edit3 aria-hidden className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="w-full max-w-2xl text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase text-brass">
                {korean ? "관리자 현장 편집" : "Inline admin edit"}
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">
                {korean ? "한활 팀채팅 정보 수정" : "Edit Hanhwal team chat"}
              </h2>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={(event) => {
                event.stopPropagation();
                setEditing(false);
              }}
              className="inline-flex h-10 w-10 items-center justify-center border border-ink/10 bg-white text-ink"
              aria-label={korean ? "편집 닫기" : "Close editor"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              {korean ? "현재 학기 / 운영기수" : "Current semester / operating period"}
              <input
                value={draftPeriodLabel}
                disabled={saving}
                maxLength={120}
                onChange={(event) => setDraftPeriodLabel(event.target.value)}
                placeholder={korean ? "예: 2026년 2학기" : "e.g. Fall 2026"}
                className="form-field"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              {korean ? "정식회원 팀채팅 링크" : "Official team chat link"}
              <input
                required
                type="url"
                value={draftUrl}
                disabled={saving}
                maxLength={1000}
                onChange={(event) => setDraftUrl(event.target.value)}
                className="form-field"
                placeholder="https://..."
              />
            </label>
            {(["ko", "en"] as const).map((locale) => (
              <label key={locale} className="grid gap-2 text-sm font-semibold text-ink">
                {locale === "ko" ? (korean ? "한국어 안내문" : "Korean instructions") : (korean ? "영어 안내문" : "English instructions")}
                <textarea disabled={saving} maxLength={2000} value={draftDescription[locale]}
                  onChange={(event) => setDraftDescription((current) => ({ ...current, [locale]: event.target.value }))}
                  className="form-field min-h-24" />
              </label>
            ))}
          </div>

          <p className="mt-3 text-xs leading-5 text-ink/55">
            {korean
              ? "링크를 저장하면 이 페이지의 QR 코드도 자동으로 새 링크를 가리키도록 갱신됩니다."
              : "Saving the link automatically regenerates the QR code shown on this page."}
          </p>
          {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving || !draftUrl.trim()}
              onClick={() => void save()}
              className="inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {korean ? "저장" : "Save"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="min-h-11 border border-ink/15 bg-white px-5 text-sm font-semibold text-ink"
            >
              {korean ? "취소" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
