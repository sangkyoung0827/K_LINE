"use client";

import { usePathname } from "next/navigation";
import { ActivityRatingModal } from "@/components/ActivityRatingModal";
import { Footer } from "@/components/Footer";
import { GlobalWoohyukmonGate } from "@/components/GlobalWoohyukmonGate";
import { Navbar } from "@/components/Navbar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ReadOnlyDeveloperNotice } from "@/components/ReadOnlyDeveloperNotice";

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicHanhwalPage = [
    "/our-activities/hanhwal",
    "/our-activities/hanhwal/gallery",
    "/our-activities/hanhwal/solbam",
    "/our-activities/hanhwal/activities"
  ].includes(pathname);

  if (isPublicHanhwalPage) {
    return <main>{children}</main>;
  }

  return (
    <div className="mobile-app-shell">
      <Navbar />
      <ReadOnlyDeveloperNotice />
      <main>{children}</main>
      <Footer />
      <MobileBottomNav />
      <ActivityRatingModal />
      <GlobalWoohyukmonGate />
    </div>
  );
}
