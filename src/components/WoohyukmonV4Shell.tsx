import type { ReactNode } from "react";

export function WoohyukmonV4Shell({ children }: { children: ReactNode }) {
  return <section className="min-h-[calc(100svh-5rem)] bg-paper">{children}</section>;
}
