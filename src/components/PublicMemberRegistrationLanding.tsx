import Link from "next/link";
import { CalendarDays, ExternalLink, QrCode } from "lucide-react";
import { eccRegistrationConfig } from "@/data/eccRegistration";
import type { MemberRegistrationCampaign } from "@/lib/memberRegistrations";

export function PublicMemberRegistrationLanding({
  campaign
}: {
  campaign: MemberRegistrationCampaign;
}) {
  const openChatUrl = eccRegistrationConfig.openChatUrl;

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 md:px-8 lg:grid-cols-[1fr_0.7fr]">
        <div className="grid content-start gap-6">
          <div className="paper-panel p-6 md:p-8">
            <p className="text-sm font-semibold uppercase text-brass">
              {campaign.targetGroup || "K_LINE"} registration
            </p>
            <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">{campaign.title}</h1>
            <p className="mt-5 text-base leading-8 text-ink/68">
              ECC uses KakaoTalk Open Chat as the first step for new member guidance. Please enter the
              Open Chat room first to check ECC information, membership fee instructions, official
              registration form, and contact information.
            </p>
            {campaign.publicNote || campaign.description ? (
              <p className="mt-4 text-sm leading-7 text-ink/62">
                {campaign.publicNote || campaign.description}
              </p>
            ) : null}
            <div className="mt-6 grid gap-2 text-sm text-ink/62">
              {campaign.startDate ? (
                <span className="inline-flex items-center gap-2">
                  <CalendarDays aria-hidden className="h-4 w-4 text-brass" />
                  Starts {campaign.startDate}
                </span>
              ) : null}
              {campaign.deadline ? (
                <span className="inline-flex items-center gap-2">
                  <CalendarDays aria-hidden className="h-4 w-4 text-brass" />
                  Deadline {campaign.deadline}
                </span>
              ) : null}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={openChatUrl}
                className="inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
              >
                <ExternalLink aria-hidden className="h-4 w-4" />
                Join ECC Open Chat
              </a>
              <Link
                href="/our-activities/ecc"
                className="inline-flex min-h-11 items-center border border-navy/20 px-5 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
              >
                Back to ECC
              </Link>
            </div>
          </div>

          <div className="paper-panel p-6">
            <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <QrCode aria-hidden className="h-4 w-4 text-brass" />
              ECC Open Chat QR
            </div>
            <img
              src="/api/ecc/open-chat-qr"
              alt="ECC KakaoTalk Open Chat QR code"
              className="aspect-square w-full max-w-xs border border-ink/10 bg-white object-contain p-3"
            />
            <p className="mt-4 text-sm leading-7 text-ink/62">
              Share this QR code with new members. It opens the ECC KakaoTalk Open Chat room first.
            </p>
            <a
              href="/api/ecc/open-chat-qr"
              download
              className="mt-4 inline-flex min-h-10 items-center justify-center border border-navy/20 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
            >
              Download QR
            </a>
          </div>
        </div>

        <div className="paper-panel grid content-start gap-6 p-6 md:p-8">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">Official registration form</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
              Fill out the Google Form after membership fee payment
            </h2>
            <p className="mt-4 text-sm leading-7 text-ink/68">
              You do not need to fill out the official Google Form before deciding to become an
              official member. Officers will guide you through Open Chat first.
            </p>
          </div>
          <a
            href={campaign.googleFormUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-navy/20 px-5 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
          >
            <ExternalLink aria-hidden className="h-4 w-4" />
            Official Google Form after payment
          </a>
        </div>
      </div>
    </section>
  );
}
