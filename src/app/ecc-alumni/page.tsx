import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, RotateCcw, ScrollText, UserRoundCheck } from "lucide-react";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "ECC Alumni",
  description:
    "ECC Alumni is an open network space for current members, previous members, alumni, and anyone interested in ECC activities.",
  path: "/ecc-alumni",
  keywords: ["ECC Alumni", "ECC", "English Conversation Club", "JBNU", "international students"]
});

const cards = [
  {
    description: "Read public ECC Alumni network notices and officer updates.",
    href: "/ecc-alumni/notices",
    icon: ScrollText,
    title: "Alumni Notices"
  },
  {
    description: "Ask whether you can join or participate in a specific ECC activity.",
    href: "/ecc-alumni/activity-inquiry",
    icon: MessageSquare,
    title: "Activity Inquiry"
  },
  {
    description: "Previous ECC members and alumni can request current semester membership again.",
    href: "/ecc-alumni/rejoin",
    icon: RotateCcw,
    title: "Rejoin ECC"
  }
];

export default async function EccAlumniPage() {
  const access = await getCurrentEccAccess();

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">ECC Network</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink md:text-7xl">
          ECC Alumni
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-ink/68">
          ECC Alumni is an open network space for current members, previous members, alumni,
          and anyone interested in ECC activities. You can read notices, ask about ECC
          activities, or apply to rejoin ECC.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/58">
          Accessing ECC Alumni does not grant current official ECC membership. The ECC OFFICIAL
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
            <Link href="/ecc-alumni/status" className="paper-panel p-6 transition hover:-translate-y-1 hover:shadow-lift md:col-span-3">
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
