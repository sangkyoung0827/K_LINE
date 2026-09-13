"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function MobileDisclosure({ title, children }: { title: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const sync = () => setOpen(desktop.matches);
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);

  return (
    <details className="mobile-disclosure min-w-0" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 border-t border-navy/10 text-sm font-semibold text-navy md:hidden">
        {title}<ChevronDown aria-hidden className="h-4 w-4 shrink-0" />
      </summary>
      <div className="pt-2 md:pt-0">{children}</div>
    </details>
  );
}
