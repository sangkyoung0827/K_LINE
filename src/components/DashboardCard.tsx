import type { LucideIcon } from "lucide-react";
import { CTAButton } from "@/components/CTAButton";

type DashboardCardProps = {
  title: string;
  koreanTitle: string;
  description: string;
  href: string;
  action: string;
  icon: LucideIcon;
};

export function DashboardCard({
  title,
  koreanTitle,
  description,
  href,
  action,
  icon: Icon
}: DashboardCardProps) {
  return (
    <article className="paper-panel grid min-h-[360px] content-between p-6 shadow-soft transition hover:border-brass hover:bg-white/65 md:p-8">
      <div>
        <div className="flex h-12 w-12 items-center justify-center bg-ink text-paper">
          <Icon aria-hidden className="h-5 w-5" />
        </div>
        <p className="mt-8 text-sm font-semibold uppercase text-brass">{koreanTitle}</p>
        <h2 className="mt-3 font-serif text-4xl font-semibold text-ink">{title}</h2>
        <p className="mt-5 text-base leading-8 text-ink/70">{description}</p>
      </div>
      <div className="mt-8">
        <CTAButton href={href}>{action}</CTAButton>
      </div>
    </article>
  );
}
