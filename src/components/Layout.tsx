import { ActivityRatingModal } from "@/components/ActivityRatingModal";
import { Footer } from "@/components/Footer";
import { GlobalWoohyukmonGate } from "@/components/GlobalWoohyukmonGate";
import { Navbar } from "@/components/Navbar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ReadOnlyDeveloperNotice } from "@/components/ReadOnlyDeveloperNotice";

export function Layout({ children }: { children: React.ReactNode }) {
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
