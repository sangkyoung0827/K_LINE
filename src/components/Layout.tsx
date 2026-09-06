import { ActivityRatingModal } from "@/components/ActivityRatingModal";
import { Footer } from "@/components/Footer";
import { GlobalWoohyukmonGate } from "@/components/GlobalWoohyukmonGate";
import { Navbar } from "@/components/Navbar";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
      <ActivityRatingModal />
      <GlobalWoohyukmonGate />
    </>
  );
}
