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
    <article className="paper-panel group relative grid min-h-[320px] overflow-hidden p-6 shadow-[0_18px_45px_rgba(31,42,68,0.06)] transition duration-200 hover:-translate-y-1 hover:border-brass/70 hover:bg-white/78 hover:shadow-[0_22px_55px_rgba(31,42,68,0.10)] md:p-8">
      <div>
        <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-navy text-brass shadow-[0_14px_28px_rgba(31,42,68,0.14)]">
          <Icon aria-hidden className="h-6 w-6" />
        </div>
        <p className="mt-8 inline-flex rounded-full bg-hanji/75 px-3 py-1 text-xs font-bold uppercase text-navy/75">
          {eyebrow}
        </p>
        <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.02em] text-navy md:text-4xl">
          {title}
        </h2>
        <p className="mt-5 text-base leading-8 text-muted">{description}</p>
      </div>
      <div className="mt-8">
        <CTAButton href={href}>{action}</CTAButton>
      </div>
    </article>
  );
}
