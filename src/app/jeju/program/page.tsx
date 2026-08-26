import type { Metadata } from "next";
import { JejuProgramPanel } from "@/components/jeju/JejuProgramPanel";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Jeju Explorer Program",
  description: "Private semester-based K_LINE Jeju Explorer program applications.",
  path: "/jeju/program"
});

export default function JejuProgramPage() {
  return <JejuProgramPanel />;
}
