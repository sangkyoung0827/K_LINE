import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginPanel } from "@/components/LoginPanel";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Login",
  description:
    "Sign in to K_LINE with a Google account through the K_LINE member login channel.",
  path: "/login"
});

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string | string[];
  }>;
};

function getCallbackUrl(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw?.startsWith("/") || raw.startsWith("//") || /[\\\s]/.test(raw)) {
    return null;
  }

  const target = new URL(raw, "https://kline.invalid");
  if (target.pathname.startsWith("//") || target.pathname === "/login" || target.pathname.startsWith("/login/")) {
    return null;
  }

  return `${target.pathname}${target.search}${target.hash}`;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, requestHeaders] = await Promise.all([searchParams, headers()]);
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const isKakaoTalk = /KAKAOTALK/i.test(userAgent);
  const isInAppBrowser = isKakaoTalk || /FBAN|FBAV|Instagram|Line\/|GSA\/|; wv\)/i.test(userAgent);
  const callbackUrl = getCallbackUrl(params?.callbackUrl);
  if (callbackUrl && (await auth())?.user) {
    redirect(callbackUrl);
  }

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <LoginPanel
          callbackUrl={callbackUrl ?? "/ecc-join"}
          isInAppBrowser={isInAppBrowser}
          isKakaoTalk={isKakaoTalk}
        />
      </div>
    </section>
  );
}
