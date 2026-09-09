import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, RotateCcw, ScrollText, UserRoundCheck } from "lucide-react";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "HANHWAL Alumni",
  description:
    "HANHWAL Alumni is an open network space for current members, previous members, alumni, and anyone interested in HANHWAL activities.",
  path: "/hanhwal-alumni",
  keywords: ["Hanhwal Alumni", "한활", "Korean traditional archery", "JBNU"]
});

const cards = [
  {
    description: "Read public HANHWAL Alumni network notices and officer updates.",
    href: "/hanhwal-alumni/notices",
    icon: ScrollText,
    title: "Alumni Notices"
  },
  {
    description: "Ask whether you can join or participate in a specific HANHWAL activity.",
    href: "/hanhwal-alumni/activity-inquiry",
    icon: MessageSquare,
    title: "Activity Inquiry"
  },
  {
    description: "Previous HANHWAL members and alumni can request current semester membership again.",
    href: "/hanhwal-alumni/rejoin",
    icon: RotateCcw,
    title: "Rejoin HANHWAL"
  }
];

export default async function HanhwalAlumniPage() {
  const access = await getCurrentHanhwalAccess();

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">HANHWAL Network</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink md:text-7xl">
          HANHWAL Alumni
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-ink/68">
          HANHWAL Alumni is an open network space for current members, previous members, alumni,
          and anyone interested in HANHWAL activities. You can read notices, ask about HANHWAL
          activities, or apply to rejoin HANHWAL.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/58">
          Accessing HANHWAL Alumni does not grant current official HANHWAL membership. The HANHWAL OFFICIAL
          team chat link and QR remain visible only to current approved official members.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className="paper-panel p-6 transition hover:-translate-y-1 hover:shadow-lift">
                <div className="flex h-12 w-12 items-center justify-center bg-navy text-paper">
                  <Icon aria-hidden className="h-5 w-5" />
                </div>
                <h2 className="mt-6 font-serif text-3xl font-semibold text-ink">{card.title}</h2>
                <p className="mt-3 text-sm leading-7 text-ink/64">{card.description}</p>
              </Link>
            );
          })}
          {access.isLoggedIn ? (
            <Link href="/hanhwal-alumni/status" className="paper-panel p-6 transition hover:-translate-y-1 hover:shadow-lift md:col-span-3">
              <div className="flex h-12 w-12 items-center justify-center bg-navy text-paper">
                <UserRoundCheck aria-hidden className="h-5 w-5" />
              </div>
              <h2 className="mt-6 font-serif text-3xl font-semibold text-ink">My Alumni Status</h2>
              <p className="mt-3 text-sm leading-7 text-ink/64">
                Check your own activity inquiries and rejoin request status.
              </p>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
