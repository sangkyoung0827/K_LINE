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
        <p className="mb-3 inline-flex rounded-full bg-hanji/75 px-3 py-1 text-xs font-bold uppercase text-navy/75">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-navy md:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-base font-medium leading-8 text-muted md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
