export function CategoryBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-7 items-center bg-brass/16 px-3 text-xs font-semibold uppercase text-wood">
      {label}
    </span>
  );
}
