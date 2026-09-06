"use client";

import { Edit3, Loader2, MessageCircle, Save, X } from "lucide-react";
import { useState } from "react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

type Props = {
  initialPeriodLabel: string;
  initialTeamChatUrl: string;
  isAdmin: boolean;
};

type OperationsResponse = {
  error?: string;
  settings?: {
    officialTeamChatUrl: string;
    periodLabel: string;
  };
};

export function EccOfficialTeamChatCard({
  initialPeriodLabel,
  initialTeamChatUrl,
  isAdmin
}: Props) {
  const { language } = useLanguage();
  const korean = language === "ko";
  const [teamChatUrl, setTeamChatUrl] = useState(initialTeamChatUrl);
  const [periodLabel, setPeriodLabel] = useState(initialPeriodLabel);
  const [draftUrl, setDraftUrl] = useState(initialTeamChatUrl);
  const [draftPeriodLabel, setDraftPeriodLabel] = useState(initialPeriodLabel);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [qrVersion, setQrVersion] = useState(0);

  const beginEditing = () => {
    if (!isAdmin) return;
    setDraftUrl(teamChatUrl);
    setDraftPeriodLabel(periodLabel);
    setError("");
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/ecc/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officialTeamChatUrl: draftUrl,
          periodLabel: draftPeriodLabel
        })
      });
      const data = (await response.json()) as OperationsResponse;

      if (!response.ok || !data.settings) {
        throw new Error(data.error || "ECC team chat settings could not be saved.");
      }

      setTeamChatUrl(data.settings.officialTeamChatUrl);
      setPeriodLabel(data.settings.periodLabel);
      setDraftUrl(data.settings.officialTeamChatUrl);
      setDraftPeriodLabel(data.settings.periodLabel);
      setQrVersion((value) => value + 1);
      setEditing(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "ECC team chat settings could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role={isAdmin && !editing ? "button" : undefined}
      tabIndex={isAdmin && !editing ? 0 : undefined}
      onClick={isAdmin && !editing ? beginEditing : undefined}
      onKeyDown={(event) => {
        if (
          isAdmin &&
          !editing &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          beginEditing();
        }
      }}
      className={`paper-panel mx-auto grid w-full max-w-5xl justify-items-center p-4 text-center sm:p-6 md:p-10 ${
        isAdmin && !editing
          ? "cursor-pointer outline-none transition hover:border-brass hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-navy/35"
          : ""
      }`}
    >
      {!editing ? (
        <>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 border border-pine/20 bg-pine/10 px-3 py-2 text-xs font-semibold uppercase text-pine">
              <I18nText en="Confirmed member" ko="정식회원 확인됨" />
            </div>

            {periodLabel ? (
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-brass">
                {periodLabel}
              </p>
            ) : null}

            <h2 className="mt-4 font-serif text-2xl font-semibold text-ink sm:mt-5 sm:text-3xl md:text-4xl">
              <I18nText en="Join the ECC team chat" ko="ECC 팀채팅에 입장하세요" />
            </h2>
            <p className="mt-4 text-sm leading-7 text-ink/66">
              <I18nText
                en="Please use your registered name or KakaoTalk display name when joining the official team chat."
                ko="공식 팀채팅에 입장할 때는 등록한 이름 또는 카카오톡 표시 이름을 사용해 주세요."
              />
            </p>

            {isAdmin ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-navy">
                <Edit3 className="h-3.5 w-3.5" />
                {korean
                  ? "관리자: 이 영역을 눌러 팀채팅 링크·QR·학기 정보를 수정할 수 있습니다."
                  : "Admin: click this area to edit the team chat link, QR destination, and semester label."}
              </p>
            ) : null}
          </div>

          <div className="mt-5 grid w-full max-w-52 gap-3 sm:mt-6 sm:max-w-60">
            <img
              key={qrVersion}
              src={`/api/ecc/official-team-qr?v=${qrVersion}`}
              alt="ECC official team chat QR code"
              className="aspect-square w-full border border-ink/10 bg-white object-contain p-3"
            />
            <a
              href={teamChatUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
            >
              <MessageCircle aria-hidden className="h-4 w-4" />
              <I18nText en="Join ECC Official Team Chat" ko="ECC 공식 팀채팅 입장" />
            </a>
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
                {korean ? "팀채팅 정보 수정" : "Edit team chat"}
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
              aria-label="Close editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              {korean ? "현재 학기 / 운영기수" : "Current semester / operating period"}
              <input
                value={draftPeriodLabel}
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
                onChange={(event) => setDraftUrl(event.target.value)}
                className="form-field"
                placeholder="https://..."
              />
            </label>
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
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
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
