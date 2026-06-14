import type { FreeBoardId } from "@/types";

export const clubMarks = {
  ecc: {
    src: "/images/ecc-mark.jpeg",
    alt: "ECC club mark"
  },
  hanhwal: {
    src: "/images/hanhwal-tiger-archer-logo.svg",
    alt: "Hanhwal tiger archer logo"
  }
} satisfies Record<FreeBoardId, { src: string; alt: string }>;

const sizeClass = {
  xs: "h-6 w-6",
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
  xl: "h-32 w-32"
} as const;

type ClubMarkProps = {
  id: FreeBoardId;
  size?: keyof typeof sizeClass;
  className?: string;
};

export function ClubMark({ id, size = "md", className = "" }: ClubMarkProps) {
  const mark = clubMarks[id];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/45 bg-white shadow-sm ${sizeClass[size]} ${className}`}
      aria-hidden="true"
    >
      <img src={mark.src} alt="" className="h-full w-full object-cover" />
    </span>
  );
}

export function getClubMarkAlt(id: FreeBoardId) {
  return clubMarks[id].alt;
}
