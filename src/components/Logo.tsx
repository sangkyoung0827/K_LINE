type LogoProps = {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  markOnly?: boolean;
  showTagline?: boolean;
  className?: string;
};

const sizeClass = {
  sm: {
    wrapper: "gap-2.5",
    mark: "h-10 w-10",
    text: "text-xl",
    tagline: "text-xs"
  },
  md: {
    wrapper: "gap-3",
    mark: "h-12 w-12 md:h-14 md:w-14",
    text: "text-2xl md:text-3xl",
    tagline: "text-xs md:text-sm"
  },
  lg: {
    wrapper: "gap-4",
    mark: "h-16 w-16",
    text: "text-5xl md:text-6xl",
    tagline: "text-sm md:text-base"
  }
};

export function Logo({
  variant = "dark",
  size = "md",
  markOnly = false,
  showTagline = true,
  className = ""
}: LogoProps) {
  const colors =
    variant === "light"
      ? {
          text: "text-paper",
          subtext: "text-paper/68",
          markBg: "bg-paper",
          markText: "text-navy",
          markBorder: "border-paper/35"
        }
      : {
          text: "text-navy",
          subtext: "text-muted",
          markBg: "bg-navy",
          markText: "text-paper",
          markBorder: "border-navy/15"
        };
  const sizes = sizeClass[size];

  return (
    <span className={`inline-flex items-center ${sizes.wrapper} ${className}`}>
      <span
        className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-[0_10px_26px_rgba(31,42,68,0.10)] ${sizes.mark} ${colors.markBg} ${colors.markBorder}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full">
          <circle
            cx="45"
            cy="19"
            r="8"
            fill="none"
            stroke={variant === "light" ? "#6B8F71" : "#D6A85A"}
            strokeWidth="3"
          />
          <path
            d="M12 44 C22 25 35 19 52 14"
            fill="none"
            stroke={variant === "light" ? "#D6A85A" : "#F4EBDD"}
            strokeLinecap="round"
            strokeWidth="5"
          />
          <path
            d="M16 18 L16 48 M16 32 L36 18 M21 32 L38 48"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5"
          />
        </svg>
      </span>
      {markOnly ? null : (
        <span className="grid leading-none">
          <span className={`font-serif font-semibold tracking-[-0.04em] ${sizes.text} ${colors.text}`}>
            K_LINE
          </span>
          {showTagline ? (
            <span className={`mt-1.5 font-semibold tracking-normal ${sizes.tagline} ${colors.subtext}`}>
              Campus K-Culture Hub
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}
