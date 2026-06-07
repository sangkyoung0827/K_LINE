import { CTAButton } from "@/components/CTAButton";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  href?: string;
};

export function EmptyState({ title, description, actionLabel, href }: EmptyStateProps) {
  return (
    <div className="paper-panel mx-auto max-w-2xl p-8 text-center">
      <h2 className="font-serif text-3xl font-semibold text-ink">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-ink/68">{description}</p>
      {actionLabel && href ? (
        <div className="mt-6">
          <CTAButton href={href}>{actionLabel}</CTAButton>
        </div>
      ) : null}
    </div>
  );
}
