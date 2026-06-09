import type { ReactNode } from "react";

type SectionHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
};

export function SectionHeader({ eyebrow, title, description, align = "left" }: SectionHeaderProps) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow ? (
        <p className="mb-3 text-sm font-semibold uppercase text-brass">{eyebrow}</p>
      ) : null}
      <h2 className="font-serif text-3xl font-semibold text-ink md:text-5xl">{title}</h2>
      {description ? (
        <p className="mt-5 text-base leading-8 text-muted md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
