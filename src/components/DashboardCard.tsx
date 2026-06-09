import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CTAButton } from "@/components/CTAButton";

type DashboardCardProps = {
  title: ReactNode;
  eyebrow: ReactNode;
  description: ReactNode;
  href: string;
  action: ReactNode;
  icon: LucideIcon;
};

export function DashboardCard({
  title,
  eyebrow,
  description,
  href,
  action,
  icon: Icon
}: DashboardCardProps) {
  return (
    <article className="paper-panel group relative grid min-h-[360px] overflow-hidden p-6 shadow-soft transition hover:-translate-y-1 hover:border-brass hover:bg-white/78 hover:shadow-lift md:p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-brass transition group-hover:bg-pine" />
      <div className="absolute right-6 top-7 h-px w-24 bg-navy/10" aria-hidden />
      <div className="absolute right-6 top-12 h-px w-16 bg-brass/45" aria-hidden />
      <div>
        <div className="relative flex h-12 w-12 items-center justify-center bg-navy text-paper">
          <Icon aria-hidden className="h-5 w-5" />
        </div>
        <p className="mt-8 text-sm font-semibold uppercase text-brass">{eyebrow}</p>
        <h2 className="mt-3 font-serif text-4xl font-semibold text-ink">{title}</h2>
        <p className="mt-5 text-base leading-8 text-ink/68">{description}</p>
      </div>
      <div className="mt-8">
        <CTAButton href={href}>{action}</CTAButton>
      </div>
    </article>
  );
}
