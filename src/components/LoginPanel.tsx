"use client";

import { CheckCircle2, LogIn, LogOut, ShieldCheck, UserCircle } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { CTAButton } from "@/components/CTAButton";

export function LoginPanel() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const isSignedIn = Boolean(session?.user);
  const displayName = session?.user?.name ?? session?.user?.email ?? "K_LINE member";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
      <section className="paper-panel p-6 md:p-8">
        <p className="text-sm font-semibold uppercase text-brass">Member Login</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold text-ink md:text-6xl">
          Join K_LINE with your Google account.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-ink/68">
          Google login is the first membership channel for K_LINE. It lets visitors sign in
          through a trusted account while future profile, order, class booking, and project
          submission systems are connected later.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {isSignedIn ? (
            <>
              <CTAButton href="/">Go to dashboard</CTAButton>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-ink/20 px-5 py-3 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
              >
                <LogOut aria-hidden className="h-4 w-4" />
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-navy disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn aria-hidden className="h-4 w-4" />
              {isLoading ? "Checking session" : "Continue with Google"}
            </button>
          )}
        </div>
      </section>

      <aside className="bg-navy p-6 text-paper md:p-8">
        <div className="flex h-12 w-12 items-center justify-center border border-paper/25">
          {isSignedIn ? (
            <CheckCircle2 aria-hidden className="h-6 w-6 text-brass" />
          ) : (
            <ShieldCheck aria-hidden className="h-6 w-6 text-brass" />
          )}
        </div>
        <h2 className="mt-6 text-2xl font-semibold">
          {isSignedIn ? "Signed in" : "Ready for Google OAuth"}
        </h2>
        <div className="mt-5 space-y-4 text-sm leading-7 text-paper/74">
          {isSignedIn ? (
            <div className="flex items-start gap-3 border border-paper/15 p-4">
              <UserCircle aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brass" />
              <div>
                <p className="font-semibold text-paper">{displayName}</p>
                <p>{session?.user?.email ?? "Google account connected."}</p>
              </div>
            </div>
          ) : (
            <>
              <p>Vercel must have Google OAuth environment variables before real login works.</p>
              <p>After login, Auth.js stores the active session. A database can be added later for full member profiles.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
