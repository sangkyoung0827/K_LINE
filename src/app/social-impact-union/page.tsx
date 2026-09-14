import type { Metadata } from "next";
import { ExternalLink, MessageCircle } from "lucide-react";
import QRCode from "qrcode";
import { I18nText } from "@/components/LanguageProvider";
import { SocialImpactUnionMark } from "@/components/social-impact-union/SocialImpactUnionMark";
import { socialImpactUnion } from "@/data/socialImpactUnion";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: socialImpactUnion.title.en,
  description: "전주를 기반으로 사람과 아이디어를 연결하는 소셜임팩트유니온의 K_LINE 공간입니다.",
  path: socialImpactUnion.path
});

export default async function SocialImpactUnionPage() {
  const qr = await QRCode.toDataURL(socialImpactUnion.openChatUrl, {
    errorCorrectionLevel: "M",
    margin: 4,
    type: "image/png",
    width: 720
  });

  return (
    <section className="bg-paper py-10 sm:py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <div className="flex items-center gap-4 sm:gap-5">
          <SocialImpactUnionMark className="h-16 w-16 border-ink/10 sm:h-24 sm:w-24" />
          <div className="min-w-0">
            <h1 className="font-serif text-3xl font-semibold text-navy sm:text-4xl md:text-5xl">Social Impact Union</h1>
            <p lang="ko" className="mt-2 text-sm font-semibold text-muted sm:text-base">소셜임팩트유니온</p>
          </div>
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-muted sm:text-base sm:leading-8">
          <I18nText {...socialImpactUnion.introduction} />
        </p>

        <div className="paper-panel mt-6 grid justify-items-center p-4 text-center sm:mt-10 sm:p-6 md:p-10">
          <h2 className="font-serif text-2xl font-semibold text-navy sm:text-3xl">
            <I18nText en="Kakao Open Chat" ko="카카오 오픈채팅" />
          </h2>
          <p className="mt-3 max-w-md text-sm leading-7 text-muted">
            <I18nText en="Meet new people and follow community news in our Open Chat." ko="활동 소식과 새로운 사람들을 오픈채팅에서 만나보세요." />
          </p>
          <div className="mt-5 grid w-full max-w-52 gap-3 sm:mt-6 sm:max-w-60">
            <img
              src={qr}
              alt="Social Impact Union Kakao Open Chat QR Code"
              width={720}
              height={720}
              className="aspect-square w-full border border-ink/10 bg-white object-contain p-3"
            />
            <a
              href={socialImpactUnion.openChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-paper transition hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy"
            >
              <MessageCircle aria-hidden className="h-4 w-4 shrink-0" />
              <I18nText en="Join Open Chat" ko="오픈채팅 참여하기" />
              <ExternalLink aria-hidden className="h-4 w-4 shrink-0" />
              <span className="sr-only"><I18nText en="(opens in a new tab)" ko="(새 탭에서 열림)" /></span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
