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
          subtext: "text-paper/68"
        }
      : {
          text: "text-navy",
          subtext: "text-muted"
        };
  const sizes = sizeClass[size];

  return (
    <span className={`inline-flex items-center ${sizes.wrapper} ${className}`}>
      <span
        className={`inline-flex shrink-0 overflow-hidden rounded-xl shadow-[0_10px_26px_rgba(31,42,68,0.14)] ${sizes.mark}`}
        aria-hidden="true"
      >
        <img
          src="/images/k-line-official-logo.png"
          alt=""
          className="h-full w-full object-cover"
        />
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
