"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, MessageCircle, QrCode } from "lucide-react";
import { CTAButton } from "@/components/CTAButton";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

type EccMember = {
  id: string;
  createdAt: string;
  name: string;
  kakaoId: string;
  email: string;
  phone: string;
  nationality: string;
  note: string;
  membershipFeePaid: boolean;
  teamChatSent: boolean;
  teamChatUrl: string;
  qrCodeUrl: string;
  paymentNote: string;
  status: string;
};

type MemberDraft = Record<
  string,
  {
    membershipFeePaid: boolean;
    teamChatSent: boolean;
    paymentNote: string;
  }
>;

function qrImageUrl(teamChatUrl: string, qrCodeUrl: string) {
  if (qrCodeUrl.trim()) {
    return qrCodeUrl.trim();
  }

  if (!teamChatUrl.trim()) {
    return "";
  }

  return `https://quickchart.io/qr?size=220&text=${encodeURIComponent(teamChatUrl.trim())}`;
}

export function EccMemberManagementPanel() {
  const [members, setMembers] = useState<EccMember[]>([]);
  const [drafts, setDrafts] = useState<MemberDraft>({});
  const [teamChatUrl, setTeamChatUrl] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { language } = useLanguage();

  useEffect(() => {
    let active = true;

    fetch("/api/ecc/members")
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }: { response: Response; data: { members?: EccMember[]; error?: string } }) => {
        if (!active) {
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "ECC members could not be loaded.");
        }

        const loadedMembers = data.members ?? [];
        setMembers(loadedMembers);
        setDrafts(
          Object.fromEntries(
            loadedMembers.map((member) => [
              member.id,
              {
                membershipFeePaid: member.membershipFeePaid,
                teamChatSent: member.teamChatSent,
                paymentNote: member.paymentNote
              }
            ])
          )
        );
        const firstUrl = loadedMembers.find((member) => member.teamChatUrl)?.teamChatUrl ?? "";
        const firstQr = loadedMembers.find((member) => member.qrCodeUrl)?.qrCodeUrl ?? "";
        setTeamChatUrl(firstUrl);
        setQrCodeUrl(firstQr);
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "ECC members could not be loaded.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const paidMembers = useMemo(
    () => members.filter((member) => drafts[member.id]?.membershipFeePaid),
    [drafts, members]
  );
  const unpaidMembers = useMemo(
    () => members.filter((member) => !drafts[member.id]?.membershipFeePaid),
    [drafts, members]
  );
  const inviteQrUrl = qrImageUrl(teamChatUrl, qrCodeUrl);
  const inviteMessage =
    language === "ko"
      ? `ECC 팀채팅 초대 안내\n\n회비 납부가 확인되어 ECC 팀채팅 초대 링크를 보내드립니다.\n${teamChatUrl || "팀채팅 URL을 입력해 주세요."}\n\nQR 코드가 필요한 경우 회원 관리 화면의 QR을 확인해 주세요.`
      : `ECC team chat invitation\n\nYour membership fee has been confirmed. Please join the ECC team chat here:\n${teamChatUrl || "Please enter a team chat URL."}\n\nUse the QR code in the member management page if needed.`;

  const updateDraft = (memberId: string, value: Partial<MemberDraft[string]>) => {
    setDrafts((current) => {
      const existing = current[memberId] ?? {
        membershipFeePaid: false,
        teamChatSent: false,
        paymentNote: ""
      };

      return {
        ...current,
        [memberId]: {
          ...existing,
          ...value
        }
      };
    });
  };

  const copyInviteMessage = async () => {
    await navigator.clipboard.writeText(inviteMessage);
    setMessage(language === "ko" ? "초대 안내문을 복사했습니다." : "Invitation message copied.");
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/ecc/members", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          members: members.map((member) => ({
            id: member.id,
            membershipFeePaid: Boolean(drafts[member.id]?.membershipFeePaid),
            teamChatSent: Boolean(drafts[member.id]?.teamChatSent),
            paymentNote: drafts[member.id]?.paymentNote ?? "",
            teamChatUrl,
            qrCodeUrl
          }))
        })
      });
      const data = (await response.json()) as { members?: EccMember[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "ECC member changes could not be saved.");
      }

      const nextMembers = data.members ?? [];
      setMembers(nextMembers);
      setDrafts(
        Object.fromEntries(
          nextMembers.map((member) => [
            member.id,
            {
              membershipFeePaid: member.membershipFeePaid,
              teamChatSent: member.teamChatSent,
              paymentNote: member.paymentNote
            }
          ])
        )
      );
      setMessage(language === "ko" ? "회원 관리 내용이 저장되었습니다." : "Member management changes saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ECC member changes could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="paper-panel p-6 text-sm font-semibold text-ink/62">
        <I18nText en="Loading ECC members..." ko="ECC 회원을 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <section className="paper-panel grid gap-6 p-5 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">
              <I18nText en="Team chat builder" ko="클럽 팀채팅 만들기" />
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
              <I18nText en="Create ECC Team Chat Invitation" ko="ECC 팀채팅 초대 만들기" />
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/68">
              <I18nText
                en="Check the membership fee box, save, then paid members become team chat invite targets. KakaoTalk auto-send requires a future Kakao API connection; until then, copy the prepared invitation message or use the QR/link."
                ko="회비 납부 체크 후 저장하면 납부 회원이 팀채팅 초대 대상이 됩니다. 카카오톡 자동 발송은 향후 Kakao API 연결이 필요하므로, 현재는 생성된 초대문/링크/QR을 복사해 사용할 수 있습니다."
              />
            </p>
          </div>
          <div className="grid min-w-40 gap-2 border border-ink/10 bg-white/45 p-4 text-sm">
            <span className="font-semibold text-ink">
              <I18nText en="Paid members" ko="납부 회원" />: {paidMembers.length}
            </span>
            <span className="text-ink/62">
              <I18nText en="Unpaid members" ko="미납 회원" />: {unpaidMembers.length}
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="grid gap-4">
            <input
              className="form-field"
              placeholder={language === "ko" ? "카카오톡 팀채팅 URL 또는 초대 링크" : "KakaoTalk team chat URL or invite link"}
              value={teamChatUrl}
              onChange={(event) => setTeamChatUrl(event.target.value)}
            />
            <input
              className="form-field"
              placeholder={language === "ko" ? "QR 이미지 URL 선택 입력" : "Optional QR image URL"}
              value={qrCodeUrl}
              onChange={(event) => setQrCodeUrl(event.target.value)}
            />
            <textarea className="form-field min-h-36" readOnly value={inviteMessage} />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyInviteMessage}
                className="inline-flex min-h-11 items-center gap-2 border border-navy/20 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
              >
                <Copy aria-hidden className="h-4 w-4" />
                <I18nText en="Copy Invite Message" ko="초대 안내문 복사" />
              </button>
              {teamChatUrl ? (
                <a
                  href={teamChatUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 border border-navy/20 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
                >
                  <ExternalLink aria-hidden className="h-4 w-4" />
                  <I18nText en="Open Link" ko="링크 열기" />
                </a>
              ) : null}
            </div>
          </div>
          <div className="grid content-start gap-3 border border-ink/10 bg-white/45 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <QrCode aria-hidden className="h-4 w-4" />
              <I18nText en="QR Code" ko="QR 코드" />
            </div>
            {inviteQrUrl ? (
              <img
                src={inviteQrUrl}
                alt="ECC team chat QR code"
                loading="lazy"
                decoding="async"
                className="aspect-square w-full border border-ink/10 bg-white object-contain p-2"
              />
            ) : (
              <div className="grid aspect-square place-items-center border border-dashed border-ink/20 bg-paper text-center text-sm leading-6 text-ink/52">
                <I18nText en="Enter a team chat URL to generate QR." ko="팀채팅 URL을 입력하면 QR이 생성됩니다." />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="paper-panel overflow-hidden">
        <div className="border-b border-ink/10 p-5 md:p-6">
          <h2 className="font-serif text-3xl font-semibold text-ink">
            <I18nText en="Registered Members" ko="등록된 회원" />
          </h2>
          <p className="mt-2 text-sm leading-7 text-ink/62">
            <I18nText
              en="Use the checkbox on the left to confirm whether each member has paid the membership fee."
              ko="가장 왼쪽 체크박스로 각 회원의 회비 납부 여부를 수동 확인합니다."
            />
          </p>
        </div>

        {members.length > 0 ? (
          <div className="divide-y divide-ink/10">
            {members.map((member) => {
              const draft = drafts[member.id] ?? {
                membershipFeePaid: member.membershipFeePaid,
                teamChatSent: member.teamChatSent,
                paymentNote: member.paymentNote
              };

              return (
                <article key={member.id} className="grid gap-4 p-5 md:grid-cols-[auto_1fr_auto] md:p-6">
                  <label className="flex items-start gap-3 text-sm font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={draft.membershipFeePaid}
                      onChange={(event) =>
                        updateDraft(member.id, {
                          membershipFeePaid: event.target.checked,
                          teamChatSent: event.target.checked ? draft.teamChatSent : false
                        })
                      }
                      className="mt-1 h-5 w-5 accent-navy"
                    />
                    <span>
                      <I18nText en="Paid" ko="납부" />
                    </span>
                  </label>

                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-ink">{member.name}</h3>
                      <span className="border border-ink/10 bg-white/55 px-2 py-1 text-xs font-semibold text-ink/58">
                        Kakao: {member.kakaoId}
                      </span>
                      {draft.membershipFeePaid ? (
                        <span className="inline-flex items-center gap-1 border border-pine/20 bg-pine/10 px-2 py-1 text-xs font-semibold text-pine">
                          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                          <I18nText en="Fee confirmed" ko="회비 납부 확인" />
                        </span>
                      ) : (
                        <span className="border border-brass/25 bg-brass/10 px-2 py-1 text-xs font-semibold text-ink">
                          <I18nText en="Payment guide needed" ko="회비 납부 안내 필요" />
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-7 text-ink/62">
                      {[member.email, member.phone, member.nationality].filter(Boolean).join(" / ") ||
                        (language === "ko" ? "추가 연락처 없음" : "No extra contact")}
                    </p>
                    {member.note ? <p className="text-sm leading-7 text-ink/62">{member.note}</p> : null}
                    {!draft.membershipFeePaid ? (
                      <p className="text-sm font-semibold text-brass">
                        <I18nText
                          en="Show this member the membership fee payment guide before sending a team chat invitation."
                          ko="팀채팅 초대 전 이 회원에게 회비 납부 안내를 보내야 합니다."
                        />
                      </p>
                    ) : (
                      <label className="mt-1 flex items-center gap-2 text-sm font-semibold text-ink/70">
                        <input
                          type="checkbox"
                          checked={draft.teamChatSent}
                          onChange={(event) =>
                            updateDraft(member.id, { teamChatSent: event.target.checked })
                          }
                          className="h-4 w-4 accent-navy"
                        />
                        <MessageCircle aria-hidden className="h-4 w-4" />
                        <I18nText en="Team chat invitation sent or handled" ko="팀채팅 초대 전송/처리 완료" />
                      </label>
                    )}
                    <input
                      className="form-field mt-2"
                      placeholder={language === "ko" ? "납부 확인 메모" : "Payment confirmation note"}
                      value={draft.paymentNote}
                      onChange={(event) => updateDraft(member.id, { paymentNote: event.target.value })}
                    />
                  </div>

                  <div className="text-left text-xs text-ink/46 md:text-right">
                    {new Date(member.createdAt).toLocaleDateString(language === "ko" ? "ko-KR" : "en-US")}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-sm leading-7 text-ink/62">
            <I18nText
              en="No ECC members have registered yet."
              ko="아직 등록된 ECC 회원이 없습니다."
            />
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <CTAButton type="button" onClick={save} disabled={saving}>
          {saving
            ? language === "ko"
              ? "저장 중..."
              : "Saving..."
            : language === "ko"
              ? "저장"
              : "Save"}
        </CTAButton>
        {message ? <p className="text-sm font-semibold text-pine">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
