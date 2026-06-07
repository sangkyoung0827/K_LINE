export function TagBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-7 items-center border border-ink/10 bg-white/55 px-3 text-xs font-semibold text-ink/68">
      {label}
    </span>
  );
}
