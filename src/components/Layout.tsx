import { ActivityRatingModal } from "@/components/ActivityRatingModal";
import { Footer } from "@/components/Footer";
import { GlobalWoohyukmonGate } from "@/components/GlobalWoohyukmonGate";
import { Navbar } from "@/components/Navbar";
import { ReadOnlyDeveloperNotice } from "@/components/ReadOnlyDeveloperNotice";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <ReadOnlyDeveloperNotice />
      <main>{children}</main>
      <Footer />
      <ActivityRatingModal />
      <GlobalWoohyukmonGate />
    </>
  );
}
