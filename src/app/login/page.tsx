import type { Metadata } from "next";
import { LoginPanel } from "@/components/LoginPanel";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Login",
  description:
    "Sign in to K_LINE with a Google account through the K_LINE member login channel.",
  path: "/login"
});

export default function LoginPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <LoginPanel />
      </div>
    </section>
  );
}
