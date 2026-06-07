"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { activityBoards } from "@/data/activityBoards";
import { navigation } from "@/data/navigation";
import { AuthStatus } from "@/components/AuthStatus";
import { useCart } from "@/components/CartProvider";
import { Logo } from "@/components/Logo";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { totalQuantity } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-navy/10 bg-paper/94 backdrop-blur">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label="K_LINE home">
          <Logo size="sm" />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navigation.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const hasBoards = item.href === "/our-activities";

            if (hasBoards) {
              return (
                <div key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium transition ${
                      active ? "text-ink" : "text-ink/62 hover:text-ink"
                    }`}
                  >
                    {item.label}
                    <ChevronDown
                      aria-hidden
                      className="h-3.5 w-3.5 transition group-hover:rotate-180"
                    />
                  </Link>
                  <div className="absolute left-0 top-full hidden min-w-52 border border-navy/10 bg-paper shadow-soft group-hover:grid group-focus-within:grid">
                    {activityBoards.map((board) => (
                      <Link
                        key={board.id}
                        href={`/our-activities/${board.slug}`}
                        className="border-b border-navy/8 px-4 py-3 text-sm font-semibold text-ink/72 transition last:border-b-0 hover:bg-brass/15 hover:text-ink"
                      >
                        {board.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-sm font-medium transition ${
                  active ? "text-ink" : "text-ink/62 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <AuthStatus />
          <Link
            href="/cart"
            aria-label="Open cart"
            className="relative inline-flex h-10 w-10 items-center justify-center border border-navy/12 text-ink transition hover:border-brass hover:bg-brass/15"
          >
            <ShoppingBag aria-hidden className="h-4 w-4" />
            {totalQuantity > 0 ? (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center bg-brass px-1 text-xs font-semibold text-ink">
                {totalQuantity}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center border border-navy/12 text-ink transition hover:border-brass hover:bg-brass/15 lg:hidden"
          >
            {open ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-navy/10 bg-paper lg:hidden">
          <div className="mx-auto grid max-w-7xl px-5 py-4">
            {navigation.map((item) => {
              const hasBoards = item.href === "/our-activities";
              return (
                <div key={item.href} className="border-b border-navy/8 last:border-b-0">
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block py-3 text-sm text-ink/76"
                  >
                    {item.label}
                  </Link>
                  {hasBoards ? (
                    <div className="grid pb-3 pl-4">
                      {activityBoards.map((board) => (
                        <Link
                          key={board.id}
                          href={`/our-activities/${board.slug}`}
                          onClick={() => setOpen(false)}
                          className="py-2 text-sm font-semibold text-ink/66"
                        >
                          {board.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
