import Link from "next/link";
import styles from "@/app/our-activities/hanhwal/hanhwal.module.css";

const base = "/our-activities/hanhwal";

export function HanhwalHeader() {
  return (
    <header className={styles.navbar}>
      <div className={styles.navContainer}>
        <Link href={base} className={styles.logo}>
          <span aria-hidden>🏹</span> <span>한활</span> Hanhwal
        </Link>
        <nav className={styles.navigation} aria-label="Hanhwal navigation">
          <Link href={base}>Home</Link>
          <Link href={`${base}/gallery`}>Gallery</Link>
          <Link href="/hanhwal-join">Join</Link>
          <Link href={`${base}/solbam`}><span aria-hidden>🐆</span> Solbam</Link>
          <Link href={`${base}/activities`}>News &amp; Activities</Link>
        </nav>
      </div>
    </header>
  );
}

export function HanhwalFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContainer}>
        <div>
          <h3>한활 Hanhwal</h3>
          <p>
            Korean Traditional Archery Club<br />
            This website is maintained by Hanhwal members and is not officially affiliated with Jeonbuk National University.<br />
            This website is still under development, and some features may not work as expected.
          </p>
        </div>
      </div>
      <div className={styles.footerBottom}>© 2026 Hanhwal. All rights reserved.</div>
    </footer>
  );
}

export function HanhwalPublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.site}>
      <HanhwalHeader />
      {children}
      <HanhwalFooter />
    </div>
  );
}
