import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HanhwalPublicShell } from "@/components/HanhwalPublicShell";
import { hanhwalFacts } from "@/lib/hanhwalPublic";
import { absoluteUrl, createPublicMetadata } from "@/lib/seo";
import styles from "./hanhwal.module.css";

const base = "/our-activities/hanhwal";
const description = "Hanhwal (한활) is a Korean traditional archery club for international students at Jeonbuk National University.";

export const metadata: Metadata = createPublicMetadata({
  title: "Hanhwal | Korean Traditional Archery Club",
  description,
  path: base,
  image: "/images/hanhwal-site/hero.webp",
  imageAlt: "Hanhwal Korean traditional archery club",
  keywords: ["Hanhwal", "한활", "Korean traditional archery", "국궁", "Jeonbuk National University"]
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SportsOrganization",
  name: "Hanhwal",
  alternateName: "한활",
  url: absoluteUrl(base),
  foundingDate: "2023-05-12",
  description,
  sport: "Korean traditional archery",
  sameAs: [hanhwalFacts.instagram],
  location: { "@type": "Place", name: "보조구장 (Auxiliary Field)", address: "전북 전주시 덕진구 건지로 20" }
};

const gallery = [
  { src: "/images/hanhwal-site/hero.webp", label: "Practice", alt: "Hanhwal Korean traditional archery practice" },
  { src: "/images/hanhwal-site/field-1.webp", label: "Field", alt: "Hanhwal auxiliary archery field" },
  { src: "/images/hanhwal-site/news.webp", label: "Activity", alt: "Hanhwal club activity" }
];

export default function HanhwalHomePage() {
  return (
    <HanhwalPublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main>
        <section className={styles.hero}>
          <Image src="/images/hanhwal-site/hero.webp" alt="Hanhwal Korean traditional archery club" fill priority sizes="100vw" className={styles.heroImage} />
          <div className={styles.heroOverlay}>
            <p className={`${styles.eyebrow} ${styles.heroEyebrow}`}>KOREAN TRADITIONAL ARCHERY CLUB<br />FOR INTERNATIONAL STUDENTS</p>
            <h1>Hanhwal</h1>
            <p>Jeonbuk National University</p>
          </div>
        </section>

        <section>
          <div className={styles.welcomeGrid}>
            <div className={styles.welcomeContent}>
              <p className={styles.eyebrow}>WELCOME</p>
              <h2>Welcome to Hanhwal</h2>
              <p className={styles.largeText}>Hanhwal (한활) is a Korean Traditional Archery Club for foreign students at Jeonbuk National University.</p>
              <p>We learn, practice, and preserve the tradition of Korean archery while building a welcoming community together.</p>
              <a href={hanhwalFacts.instagram} target="_blank" rel="noopener noreferrer" className={styles.primaryButton}>Visit our Instagram →</a>
            </div>
            <div className={styles.solbamIntro}>
              <p className={styles.eyebrow}>YOUR ARCHERY BUDDY</p>
              <div className={styles.solbamTitleRow}>
                <Image src="/images/hanhwal-site/solbam.webp" alt="Solbam mascot" width={105} height={105} className={styles.solbamSmallImage} />
                <h2>Chat with<br />Solbam 🐆</h2>
              </div>
              <p className={styles.largeText}>Curious about our club? Ask Solbam about Hanhwal, equipment, etiquette, practice, and more.</p>
              <Link href={`${base}/solbam`} className={styles.primaryButton}>Start Chat →</Link>
            </div>
          </div>
        </section>

        <section className={styles.practiceSection}>
          <div className={styles.sectionContainer}>
            <div className={styles.practiceHeading}>
              <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>PRACTICE WITH US</p>
              <h2>Find us on the field.</h2>
            </div>
            <div className={styles.practiceLayout}>
              <div className={styles.fieldSlider}>
                <div className={styles.fieldSlides}>
                  <div className={styles.fieldSlide}><Image src="/images/hanhwal-site/field-1.webp" alt="Hanhwal auxiliary archery field" fill sizes="(max-width: 900px) 100vw, 60vw" /></div>
                  <div className={styles.fieldSlide}><Image src="/images/hanhwal-site/field-2.webp" alt="Hanhwal practice field" fill sizes="(max-width: 900px) 100vw, 60vw" /></div>
                </div>
                <div className={styles.sliderLabel}>보조구장 · Auxiliary Field</div>
                <div className={styles.sliderDots} aria-hidden><span /><span /></div>
              </div>
              <div className={styles.locationContent}>
                <p className={styles.locationEyebrow}>📍 PRACTICE LOCATION</p>
                <h3>보조구장</h3>
                <p className={styles.locationSubtitle}>Auxiliary Archery Field</p>
                <div className={styles.locationDetails}>
                  <div className={styles.locationDetail}><span className={styles.detailIcon}>📍</span><div><strong>Address</strong><p>전북 전주시 덕진구 건지로 20</p></div></div>
                  <div className={styles.locationDetail}><span className={styles.detailIcon}>🏹</span><div><strong>Time Practice</strong><p>Every Saturday, 10AM - 12PM</p></div></div>
                </div>
                <a href={hanhwalFacts.map} target="_blank" rel="noopener noreferrer" className={styles.mapButton}>Open in Naver Map →</a>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>HANHWAL GALLERY</p><h2>Moments on and off the field.</h2></div>
              <Link href={`${base}/gallery`} className={styles.outlineButton}>View Gallery →</Link>
            </div>
            <div className={styles.galleryGrid}>
              {gallery.map((photo) => (
                <Link href={`${base}/gallery`} className={styles.galleryItem} key={photo.src}>
                  <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 900px) 100vw, 40vw" />
                  <span className={styles.galleryLabel}>{photo.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.joinSection}>
          <div className={styles.joinGrid}>
            <div className={styles.joinContent}>
              <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>BECOME PART OF HANHWAL</p>
              <h2>Join Hanhwal</h2>
              <p>Come practice with us and become part of our community.</p>
              <Link href="/hanhwal-join" className={styles.lightButton}>Join the Club →</Link>
            </div>
          </div>
        </section>

        <section className={styles.newsSection}>
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>LATEST NEWS</p><h2>What we&apos;ve been up to.</h2></div>
              <Link href={`${base}/activities`} className={styles.outlineButton}>View All News →</Link>
            </div>
            <div className={styles.newsSlider}>
              <article className={styles.newsCard}>
                <div className={styles.newsImage}><Image src="/images/hanhwal-site/news.webp" alt="Hanhwal Korean archery experience" fill sizes="(max-width: 900px) 100vw, 33vw" /></div>
                <div className={styles.newsContent}><span className={styles.newsCategory}>ACTIVITY</span><h3>Korean Archery Experience with International Students</h3><time className={styles.newsDate}>Hanhwal activity story</time><p>Sharing Korean traditional archery, concentration, safety, and cultural meaning together.</p></div>
              </article>
            </div>
          </div>
        </section>
      </main>
    </HanhwalPublicShell>
  );
}
