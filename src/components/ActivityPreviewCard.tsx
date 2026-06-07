import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";
import type { FreeBoard } from "@/types";

type ActivityPreviewCardProps = {
  board: FreeBoard;
  accent: "gold" | "green";
};

const accentClass = {
  gold: "bg-brass text-ink",
  green: "bg-pine text-paper"
};

export function ActivityPreviewCard({ board, accent }: ActivityPreviewCardProps) {
  return (
    <Link
      href={`/our-activities/${board.slug}`}
      className="paper-panel group grid overflow-hidden shadow-soft transition hover:-translate-y-1 hover:border-brass hover:bg-white/78 hover:shadow-lift"
    >
      <div className="relative min-h-48 overflow-hidden bg-navy">
        <div className="absolute inset-0 opacity-80">
          <div className="absolute left-8 top-10 h-px w-48 origin-left -rotate-12 bg-paper/24" />
          <div className="absolute right-8 top-8 h-px w-28 origin-left rotate-12 bg-paper/18" />
          <div className="absolute bottom-8 left-8 h-1 w-48 origin-left -rotate-12 bg-brass" />
          <div className="absolute bottom-14 left-14 h-1 w-32 origin-left -rotate-12 bg-pine" />
        </div>
        <div className="relative flex h-full min-h-48 items-end justify-between p-6 text-paper">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">{board.label}</p>
            <h3 className="mt-3 font-serif text-4xl font-semibold">{board.title}</h3>
          </div>
          <span className={`flex h-12 w-12 items-center justify-center ${accentClass[accent]}`}>
            <UsersRound aria-hidden className="h-5 w-5" />
          </span>
        </div>
      </div>
      <div className="grid gap-4 p-6">
        <p className="text-sm font-semibold text-muted">{board.koreanTitle}</p>
        <p className="text-sm leading-7 text-ink/70">{board.description}</p>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          Open Activity Board
          <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
