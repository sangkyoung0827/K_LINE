type LogoProps = {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  markOnly?: boolean;
  showTagline?: boolean;
  className?: string;
};

const sizeClass = {
  sm: {
    wrapper: "gap-2",
    mark: "h-9 w-9",
    text: "text-lg",
    tagline: "text-[0.66rem]"
  },
  md: {
    wrapper: "gap-3",
    mark: "h-11 w-11",
    text: "text-2xl",
    tagline: "text-xs"
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
          text: "text-ink",
          subtext: "text-muted",
          markBg: "bg-navy",
          markText: "text-paper",
          markBorder: "border-navy/15"
        };
  const sizes = sizeClass[size];

  return (
    <span className={`inline-flex items-center ${sizes.wrapper} ${className}`}>
      <span
        className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden border ${sizes.mark} ${colors.markBg} ${colors.markBorder}`}
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
          <span className={`font-semibold tracking-normal ${sizes.text} ${colors.text}`}>K_LINE</span>
          {showTagline ? (
            <span className={`mt-1 font-medium tracking-normal ${sizes.tagline} ${colors.subtext}`}>
              Campus K-Culture Hub
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}
