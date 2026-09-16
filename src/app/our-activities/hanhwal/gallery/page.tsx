"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { HanhwalPublicShell } from "@/components/HanhwalPublicShell";
import styles from "../hanhwal.module.css";

const photos = [
  { src: "/images/hanhwal-site/hero.webp", category: "Practice", caption: "Traditional archery practice with Hanhwal members.", alt: "Hanhwal traditional archery practice" },
  { src: "/images/hanhwal-site/field-1.webp", category: "Practice", caption: "The auxiliary field where Hanhwal meets each week.", alt: "Hanhwal auxiliary archery field" },
  { src: "/images/hanhwal-site/field-2.webp", category: "Event", caption: "A day on the field with the Hanhwal community.", alt: "Hanhwal practice field" },
  { src: "/images/hanhwal-site/news.webp", category: "Other", caption: "A memorable Korean archery experience.", alt: "Hanhwal club activity" },
  { src: "/images/hanhwal-site/single-bow.webp", category: "Equipment", caption: "Korean traditional bow and archery equipment.", alt: "Korean traditional single bow" },
  { src: "/images/hanhwal-site/arrows.webp", category: "Equipment", caption: "Arrows used in Korean traditional archery.", alt: "Korean traditional archery arrows" }
];

const filters = ["All", "Practice", "Competition", "Event", "MT", "Other"];

export default function HanhwalGalleryPage() {
  const [filter, setFilter] = useState("All");
  const visible = useMemo(() => filter === "All" ? photos : photos.filter((photo) => photo.category === filter), [filter]);

  return (
    <HanhwalPublicShell>
      <main className={styles.innerPage}>
        <section className={styles.pageContainer}>
          <div className={styles.pageHeader}>
            <p className={styles.eyebrow}>HANHWAL</p>
            <h1>Gallery</h1>
            <p>Moments from Hanhwal practice, competitions, events, and MT.</p>
          </div>
          <div className={styles.filterBar} role="group" aria-label="Gallery categories">
            {filters.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`${styles.filterButton} ${filter === item ? styles.filterButtonActive : ""}`}>{item}</button>)}
          </div>
          <div className={styles.publicGalleryGrid}>
            {visible.map((photo) => <article className={styles.publicGalleryCard} key={`${photo.src}-${photo.category}`}>
              <div className={styles.publicGalleryImage}><Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw" /></div>
              <div className={styles.publicGalleryBody}><div className={styles.publicGalleryCategory}>{photo.category}</div><p className={styles.publicGalleryCaption}>{photo.caption}</p></div>
            </article>)}
          </div>
        </section>
      </main>
    </HanhwalPublicShell>
  );
}
