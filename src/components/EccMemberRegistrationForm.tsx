"use client";

import { Download, ExternalLink, MessageCircle, ShieldCheck } from "lucide-react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import { eccRegistrationConfig } from "@/data/eccRegistration";

const flowItems = [
  {
    en: "Join ECC Open Chat",
    ko: "ECC 오픈채팅방 입장"
  },
  {
    en: "Read the ECC membership guide",
    ko: "ECC 활동 및 회비 안내 확인"
  },
  {
    en: "Pay the membership fee",
    ko: "회비 납부"
  },
  {
    en: "Fill out the official Google Form",
    ko: "정식회원 등록 구글폼 작성"
  },
  {
    en: "Wait for officer confirmation",
    ko: "운영진 확인 후 정식회원 등록 완료"
  }
];

const guideItems = [
  {
    en: "ECC official member registration Google Form",
    ko: "ECC 정식회원 등록 구글폼"
  },
  {
    en: "ECC activity guide",
    ko: "ECC 활동 안내"
  },
  {
    en: "membership fee account information",
    ko: "회비 납부 계좌"
  },
  {
    en: "payment method for international students without a Korean bank account",
    ko: "한국 계좌가 없는 외국인 학생의 회비 납부 방법"
  },
  {
    en: "ECC Instagram and officer contact information",
    ko: "ECC 인스타그램 및 임원 문의 방법"
  },
  {
    en: "frequently asked questions",
    ko: "자주 묻는 질문"
  }
];

export function EccMemberRegistrationForm() {
  const { language } = useLanguage();
  const openChatUrl = eccRegistrationConfig.openChatUrl;

  return (
    <div className="grid gap-8">
      <section className="paper-panel grid gap-6 p-5 md:p-8 lg:grid-cols-[1.1fr_260px]">
        <div>
          <div className="inline-flex items-center gap-2 border border-brass/25 bg-brass/10 px-3 py-2 text-xs font-semibold uppercase text-brass">
            <MessageCircle aria-hidden className="h-4 w-4" />
            <I18nText en="ECC Open Chat first" ko="오픈채팅 먼저 입장" />
          </div>
          <h2 className="mt-5 font-serif text-4xl font-semibold text-ink">
            <I18nText en="ECC New Member Registration" ko="ECC 신규회원 등록" />
          </h2>
          <p className="mt-5 text-base leading-8 text-ink/68">
            <I18nText
              en="ECC uses KakaoTalk Open Chat as the first step for new member guidance. Please enter the Open Chat room first to check ECC information, membership fee instructions, official registration form, and contact information."
              ko="ECC 신규회원 등록은 먼저 오픈채팅방 입장 후 안내를 확인하는 방식으로 진행됩니다. 아직 회비를 납부하지 않은 경우 정식회원이 아니므로, 구체적인 개인정보는 정식회원 등록 구글폼에서만 수집합니다."
            />
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={openChatUrl}
              className="inline-flex min-h-11 items-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-paper shadow-sm transition hover:-translate-y-0.5 hover:bg-navy"
            >
              <ExternalLink aria-hidden className="h-4 w-4" />
              <I18nText en="Join ECC Open Chat" ko="ECC 오픈채팅방 입장하기" />
            </a>
            <a
              href="/api/ecc/open-chat-qr"
              download
              className="inline-flex min-h-11 items-center gap-2 border border-navy/20 px-5 py-3 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-brass hover:bg-brass/15"
            >
              <Download aria-hidden className="h-4 w-4" />
              <I18nText en="Download QR" ko="QR 다운로드" />
            </a>
          </div>
        </div>

        <div className="grid content-start gap-4">
          <img
            src="/api/ecc/open-chat-qr"
            alt={
              language === "ko"
                ? "ECC 오픈채팅방으로 연결되는 QR 코드"
                : "QR code linking to ECC KakaoTalk Open Chat"
            }
            className="aspect-square w-full border border-ink/10 bg-white object-contain p-3"
          />
          <p className="break-all text-sm leading-7 text-ink/58">{openChatUrl}</p>
        </div>
      </section>

      <section className="paper-panel p-5 md:p-8">
        <p className="text-sm font-semibold uppercase text-brass">
          <I18nText en="Registration flow" ko="등록 절차" />
        </p>
        <div className="mt-5 grid gap-3">
          {flowItems.map((item, index) => (
            <div key={item.en} className="flex items-start gap-4 border border-ink/10 bg-white/50 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-navy text-sm font-semibold text-paper">
                {index + 1}
              </span>
              <p className="pt-1 text-sm font-semibold text-ink">
                <I18nText en={item.en} ko={item.ko} />
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="paper-panel p-5 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-pine text-paper">
            <ShieldCheck aria-hidden className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-3xl font-semibold text-ink">
              <I18nText en="KakaoTalk Open Chat Guide" ko="카카오톡 오픈채팅 안내" />
            </h2>
            <p className="mt-4 text-sm leading-7 text-ink/68">
              <I18nText
                en="When you enter the ECC Open Chat room, the room bot will automatically send information about:"
                ko="오픈채팅방에 입장하면 방장봇이 다음 정보를 자동으로 안내합니다."
              />
            </p>
            <ul className="mt-5 grid gap-2 text-sm leading-7 text-ink/68 md:grid-cols-2">
              {guideItems.map((item) => (
                <li key={item.en} className="border-l-2 border-brass/60 pl-3">
                  <I18nText en={item.en} ko={item.ko} />
                </li>
              ))}
            </ul>
            <div className="mt-6 border border-pine/20 bg-pine/10 p-4 text-sm font-semibold leading-7 text-ink">
              <I18nText
                en="You do not need to fill out the official Google Form before deciding to become an official member."
                ko="정식회원으로 가입하기 전에는 구글폼을 작성하지 않아도 됩니다."
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
