export function SocialImpactUnionMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/45 bg-white shadow-sm ${className}`} aria-hidden="true">
      {/* Frame the symbol in the unmodified source; the adjacent heading supplies its name. */}
      <svg viewBox="0 0 650 650" className="h-full w-full overflow-hidden" focusable="false">
        <svg y="90" width="650" height="470" viewBox="300 300 650 470" overflow="hidden" preserveAspectRatio="xMidYMid meet">
          <image href="/images/social-impact-union-logo.png" width="1254" height="1254" />
        </svg>
      </svg>
    </span>
  );
}
