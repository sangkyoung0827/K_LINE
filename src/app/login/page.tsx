import type { Metadata } from "next";
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

  if (!raw || !raw.startsWith("/") || raw.startsWith("/login")) {
    return "/ecc-join";
  }

  return raw;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = getCallbackUrl(params?.callbackUrl);

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <LoginPanel callbackUrl={callbackUrl} />
      </div>
    </section>
  );
}
