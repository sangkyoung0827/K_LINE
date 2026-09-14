// Temporary K_LINE mark until an official SIU brand asset is supplied.
export function SocialImpactUnionMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/45 bg-white shadow-sm ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" className="h-full w-full text-navy" focusable="false">
        <path d="M14 43Q16 24 32 16Q48 24 50 43Q32 53 14 43Z" className="stroke-brass" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="32" cy="16" r="6" fill="currentColor" />
        <circle cx="14" cy="43" r="6" fill="currentColor" />
        <circle cx="50" cy="43" r="6" fill="currentColor" />
      </svg>
    </span>
  );
}
