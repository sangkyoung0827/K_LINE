"use client";

import { ExternalLink, Loader2, MessageCircle, QrCode, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useReadOnlyDeveloper } from "@/components/ReadOnlyDeveloperNotice";

type Settings = {
  officialTeamChatUrl: string;
  periodLabel: string;
  updatedAt: string;
};

type OperationsResponse = {
  canManage?: boolean;
  error?: string;
  settings?: Settings;
};

const emptySettings: Settings = {
  officialTeamChatUrl: "",
  periodLabel: "",
  updatedAt: ""
};

export function HanhwalOperationsManagementPanel() {
  const { language } = useLanguage();
  const korean = language === "ko";
  const readOnly = useReadOnlyDeveloper();
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [draft, setDraft] = useState<Settings>(emptySettings);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [qrVersion, setQrVersion] = useState(0);

  useEffect(() => {
    let active = true;

    fetch("/api/hanhwal/operations")
      .then(async (response) => ({
        response,
        data: (await response.json()) as OperationsResponse
      }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok || !data.settings) {
          throw new Error(data.error || "Hanhwal operations could not be loaded.");
        }
        setSettings(data.settings);
        setDraft(data.settings);
        setCanManage(Boolean(data.canManage));
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Hanhwal operations could not be loaded."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/hanhwal/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = (await response.json()) as OperationsResponse;

      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Hanhwal operations could not be saved.");
      }

      setSettings(data.settings);
      setDraft(data.settings);
      setQrVersion((value) => value + 1);
      setMessage(
        korean
          ? "운영 설정을 저장했습니다. 팀채팅 링크와 QR이 즉시 반영됩니다."
          : "Operations saved. The team chat link and QR are updated immediately."
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Hanhwal operations could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="paper-panel flex items-center gap-3 p-6 text-sm font-semibold text-ink/62">
        <Loader2 className="h-4 w-4 animate-spin" />
        {korean ? "운영 설정을 불러오는 중입니다." : "Loading operations settings."}
      </div>
    );
  }

  const editable = canManage && !readOnly;

  return (
    <div className="grid gap-6">
      <section className="paper-panel p-5 md:p-8">
        <p className="text-sm font-semibold uppercase text-brass">
          {korean ? "한활 학기 운영" : "Hanhwal semester operations"}
        </p>
        <h2 className="mt-3 font-serif text-3xl font-semibold text-ink md:text-4xl">
          {korean ? "새 학기 운영 정보" : "New-semester operations"}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/64">
          {korean
            ? "한활 회원 데이터와 기존 신청 기록은 그대로 두고, 학기마다 바뀌는 운영기수와 팀채팅 링크만 교체합니다."
            : "Keep Hanhwal member data and existing applications unchanged while replacing only the operating period and team chat link."}
        </p>

        <div className="mt-7 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold text-ink">
            {korean ? "현재 학기 / 운영기수" : "Current semester / operating period"}
            <input
              disabled={!editable}
              value={draft.periodLabel}
              onChange={(event) =>
                setDraft((current) => ({ ...current, periodLabel: event.target.value }))
              }
              placeholder={korean ? "예: 2026년 2학기" : "e.g. Fall 2026"}
              className="form-field disabled:opacity-60"
            />
          </label>

          <section className="grid gap-4 border border-ink/10 bg-white/45 p-4 md:grid-cols-[1fr_auto] md:items-center md:p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-brass" />
                <h3 className="font-serif text-xl font-semibold text-ink">
                  {korean ? "한활 정식회원 팀채팅" : "Hanhwal official-member team chat"}
                </h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink/54">
                {korean
                  ? "한활 OFFICIAL에 표시되는 정식회원 전용 링크와 QR입니다."
                  : "Protected link and QR shown inside Hanhwal OFFICIAL."}
              </p>
              <input
                required
                disabled={!editable}
                type="url"
                value={draft.officialTeamChatUrl}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    officialTeamChatUrl: event.target.value
                  }))
                }
                className="form-field mt-3 w-full disabled:opacity-60"
                placeholder="https://..."
              />
              {draft.officialTeamChatUrl ? (
                <a
                  href={draft.officialTeamChatUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-navy underline underline-offset-4"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {korean ? "현재 링크 열기" : "Open current link"}
                </a>
              ) : null}
            </div>
            <div className="grid justify-items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-ink/48">
                <QrCode className="h-3.5 w-3.5" /> QR
              </div>
              <img
                key={qrVersion}
                src={`/api/hanhwal/official-team-qr?v=${qrVersion}`}
                alt=""
                className="h-32 w-32 border border-ink/10 bg-white object-contain p-2"
              />
            </div>
          </section>
        </div>

        {message ? <p className="mt-5 text-sm font-semibold text-pine">{message}</p> : null}
        {error ? <p className="mt-5 text-sm font-semibold text-red-700">{error}</p> : null}

        {editable ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving || !draft.officialTeamChatUrl.trim()}
              onClick={() => void save()}
              className="inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {korean ? "운영 설정 저장" : "Save operations"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(settings);
                setMessage("");
                setError("");
              }}
              className="min-h-11 border border-ink/15 bg-white px-5 text-sm font-semibold text-ink"
            >
              {korean ? "변경 취소" : "Reset changes"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="border border-pine/20 bg-pine/10 p-5 text-sm leading-7 text-ink/68">
        <strong className="text-ink">
          {korean ? "활동 운영은 한활 활동 페이지에서 관리합니다." : "Activities are managed on the Hanhwal Activity page."}
        </strong>
        <p className="mt-1">
          {korean
            ? "관리자 이상은 기존 활동 페이지에서 신청 열기/닫기와 활동비를 계속 관리할 수 있습니다."
            : "Admins continue to manage application opening, closing, and activity fees on the existing activity page."}
        </p>
      </section>
    </div>
  );
}
