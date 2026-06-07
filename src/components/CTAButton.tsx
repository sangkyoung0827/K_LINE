import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

type CTAButtonProps = {
  href?: string;
  children: ReactNode;
  variant?: "dark" | "light" | "outline" | "lightOutline";
  type?: "button" | "submit";
  onClick?: () => void;
};

const variantClass = {
  dark: "bg-ink text-paper hover:bg-navy",
  light: "bg-paper text-ink hover:bg-white",
  outline: "border border-ink/20 text-ink hover:border-brass hover:bg-brass/10",
  lightOutline: "border border-paper/40 text-paper hover:border-brass hover:bg-paper/10"
};

export function CTAButton({
  href,
  children,
  variant = "dark",
  type = "button",
  onClick
}: CTAButtonProps) {
  const className = `inline-flex min-h-11 items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition ${variantClass[variant]}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={className}>
      {children}
      <ArrowRight aria-hidden className="h-4 w-4" />
    </button>
  );
}
