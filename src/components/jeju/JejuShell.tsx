"use client";

import { BookOpen, MapPinned, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const routes = [
  { href: "/jeju", icon: BookOpen, label: "My Journey" },
  { href: "/jeju/profile", icon: UserRound, label: "Profile" }
];

export function JejuShell({ children, eyebrow, title, description, actions, showNavigation = true }: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  showNavigation?: boolean;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-[calc(100svh-76px)] overflow-x-hidden bg-[#eff8f5] text-ink sm:min-h-[calc(100svh-92px)]">
      <section className="border-b border-[#0d5962]/12 bg-[#e4f3ee]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-[#0d5962]">
                <MapPinned aria-hidden className="h-4 w-4" />
                {eyebrow || "K_LINE / My Journey"}
              </p>
              <h1 className="mt-2 font-serif text-3xl font-semibold text-[#073c44] sm:text-4xl">{title}</h1>
              {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[#234e53] sm:text-base">{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </div>
      </section>

      {showNavigation ? (
        <nav aria-label="My Journey" className="sticky top-[76px] z-30 border-b border-[#0d5962]/10 bg-[#f9fdfb]/95 backdrop-blur sm:top-[92px]">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 sm:px-5 lg:px-8">
            {routes.map((route) => {
              const active = route.href === "/jeju" ? pathname === route.href : pathname.startsWith(route.href);
              const Icon = route.icon;
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
                    active
                      ? "bg-[#0d5962] text-white shadow-[0_8px_18px_rgba(13,89,98,0.18)]"
                      : "text-[#315b5f] hover:bg-[#dcedea] hover:text-[#073c44]"
                  }`}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                  {route.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">{children}</div>
    </main>
  );
}
