"use client";

import { ExternalLink, Loader2, MessageCircle, QrCode, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type Settings = {
  inquiryChatUrl: string;
  newMemberOpenChatUrl: string;
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
  inquiryChatUrl: "",
  newMemberOpenChatUrl: "",
  officialTeamChatUrl: "",
  periodLabel: "",
  updatedAt: ""
};

export function EccOperationsManagementPanel() {
  const { language } = useLanguage();
  const korean = language === "ko";
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [draft, setDraft] = useState<Settings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [qrVersion, setQrVersion] = useState(0);

  useEffect(() => {
    let active = true;

    fetch("/api/ecc/operations")
      .then(async (response) => ({
        response,
        data: (await response.json()) as OperationsResponse
      }))
      .then(({ response, data }) => {
        if (!active) return;

        if (!response.ok || !data.settings) {
          throw new Error(data.error || "ECC operations could not be loaded.");
        }

        setSettings(data.settings);
        setDraft(data.settings);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "ECC operations could not be loaded."
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
      const response = await fetch("/api/ecc/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = (await response.json()) as OperationsResponse;

      if (!response.ok || !data.settings) {
        throw new Error(data.error || "ECC operations could not be saved.");
      }

      setSettings(data.settings);
      setDraft(data.settings);
      setQrVersion((value) => value + 1);
      setMessage(
        korean
          ? "운영 설정을 저장했습니다. 링크와 QR이 즉시 새 값으로 반영됩니다."
          : "Operations saved. Links and QR codes now use the new values."
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "ECC operations could not be saved."
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

  return (
    <div className="grid gap-6">
      <section className="paper-panel p-5 md:p-8">
        <p className="text-sm font-semibold uppercase text-brass">
          {korean ? "학기 운영" : "Semester operations"}
        </p>
        <h2 className="mt-3 font-serif text-3xl font-semibold text-ink md:text-4xl">
          {korean ? "다음 운영진이 여기만 바꾸면 됩니다" : "One place for each new officer team"}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/64">
          {korean
            ? "회원 데이터와 기존 신청 기록은 그대로 두고, 학기마다 바뀌는 카카오톡 방과 운영기수만 교체합니다. 링크를 저장하면 QR도 자동으로 갱신됩니다."
            : "Member data and existing applications stay untouched. Replace only semester-specific KakaoTalk rooms and the operating period. QR codes regenerate automatically from the saved links."}
        </p>

        <div className="mt-7 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold text-ink">
            {korean ? "현재 학기 / 운영기수" : "Current semester / operating period"}
            <input
              value={draft.periodLabel}
              onChange={(event) =>
                setDraft((current) => ({ ...current, periodLabel: event.target.value }))
              }
              placeholder={korean ? "예: 2026년 2학기" : "e.g. Fall 2026"}
              className="form-field"
            />
          </label>

          <ChatSetting
            title={korean ? "신규회원 오픈채팅" : "New-member open chat"}
            description={
              korean
                ? "신규 회원 안내용 링크입니다. 저장하면 공개 QR도 함께 바뀝니다."
                : "Public new-member room. Saving this also replaces the public QR."
            }
            value={draft.newMemberOpenChatUrl}
            onChange={(value) =>
              setDraft((current) => ({ ...current, newMemberOpenChatUrl: value }))
            }
            qrSrc={`/api/ecc/open-chat-qr?v=${qrVersion}`}
          />

          <ChatSetting
            title={korean ? "ECC 문의 오픈채팅" : "ECC inquiry chat"}
            description={
              korean
                ? "신규회원 등록 화면의 문의 링크로 사용됩니다."
                : "Used as the inquiry link on the new-member registration screen."
            }
            value={draft.inquiryChatUrl}
            onChange={(value) =>
              setDraft((current) => ({ ...current, inquiryChatUrl: value }))
            }
          />

          <ChatSetting
            title={korean ? "정식회원 팀채팅" : "Official-member team chat"}
            description={
              korean
                ? "ECC OFFICIAL의 정식회원 전용 링크와 QR입니다."
                : "Protected link and QR shown inside ECC OFFICIAL."
            }
            value={draft.officialTeamChatUrl}
            onChange={(value) =>
              setDraft((current) => ({ ...current, officialTeamChatUrl: value }))
            }
            qrSrc={`/api/ecc/official-team-qr?v=${qrVersion}`}
          />
        </div>

        {message ? <p className="mt-5 text-sm font-semibold text-pine">{message}</p> : null}
        {error ? <p className="mt-5 text-sm font-semibold text-red-700">{error}</p> : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
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
      </section>

      <section className="border border-pine/20 bg-pine/10 p-5 text-sm leading-7 text-ink/68">
        <strong className="text-ink">
          {korean ? "활동 교체는 ECC 활동 페이지에서 관리합니다." : "Activities are managed on the ECC Activity page."}
        </strong>
        <p className="mt-1">
          {korean
            ? "관리자에게만 새 활동 추가·삭제·신청 열기/닫기·활동비 설정이 표시되며 일반 회원의 신청 화면은 기존처럼 단순하게 유지됩니다."
            : "Only admins see add/remove/open/close/payment controls. The member application flow stays as simple as before."}
        </p>
      </section>
    </div>
  );
}

function ChatSetting({
  description,
  onChange,
  qrSrc,
  title,
  value
}: {
  description: string;
  onChange: (value: string) => void;
  qrSrc?: string;
  title: string;
  value: string;
}) {
  return (
    <section className="grid gap-4 border border-ink/10 bg-white/45 p-4 md:grid-cols-[1fr_auto] md:items-center md:p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-brass" />
          <h3 className="font-serif text-xl font-semibold text-ink">{title}</h3>
        </div>
        <p className="mt-2 text-xs leading-5 text-ink/54">{description}</p>
        <input
          required
          type="url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="form-field mt-3 w-full"
          placeholder="https://..."
        />
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-navy underline underline-offset-4"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open current link
          </a>
        ) : null}
      </div>

      {qrSrc ? (
        <div className="grid justify-items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink/48">
            <QrCode className="h-3.5 w-3.5" />
            QR
          </div>
          <img
            src={qrSrc}
            alt=""
            className="h-32 w-32 border border-ink/10 bg-white object-contain p-2"
          />
        </div>
      ) : null}
    </section>
  );
}
