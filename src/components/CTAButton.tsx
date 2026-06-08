import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

type CTAButtonProps = {
  href?: string;
  children: ReactNode;
  variant?: "dark" | "light" | "outline" | "lightOutline" | "gold" | "green";
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
};

const variantClass = {
  dark: "bg-navy text-paper hover:bg-ink",
  light: "bg-paper text-ink hover:bg-white",
  outline: "border border-navy/20 text-ink hover:border-brass hover:bg-brass/15",
  lightOutline: "border border-paper/45 text-paper hover:border-brass hover:bg-paper/12",
  gold: "bg-brass text-ink hover:bg-paper",
  green: "bg-pine text-paper hover:bg-navy"
};

export function CTAButton({
  href,
  children,
  variant = "dark",
  type = "button",
  onClick,
  disabled = false
}: CTAButtonProps) {
  const className = `inline-flex min-h-11 items-center justify-center gap-2 px-5 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${variantClass[variant]}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
      <ArrowRight aria-hidden className="h-4 w-4" />
    </button>
  );
}
