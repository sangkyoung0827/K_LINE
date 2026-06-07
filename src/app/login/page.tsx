import type { Metadata } from "next";
import { LoginPanel } from "@/components/LoginPanel";
import { seoKeywords, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Login",
  description:
    "Sign in to K_LINE with a Google account through the K_LINE member login channel.",
  keywords: [...seoKeywords, "K_LINE login", "Google login", "member signup"],
  openGraph: {
    title: "Login | K_LINE",
    description: "Use Google login to join the K_LINE Korean cultural platform.",
    url: `${siteConfig.url}/login`
  },
  alternates: {
    canonical: `${siteConfig.url}/login`
  }
};

export default function LoginPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <LoginPanel />
      </div>
    </section>
  );
}
