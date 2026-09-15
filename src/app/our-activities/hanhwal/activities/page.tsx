import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HanhwalPublicShell } from "@/components/HanhwalPublicShell";
import styles from "../hanhwal.module.css";

export const metadata: Metadata = { title: "News & Activities | Hanhwal", description: "Stories, activities, achievements, and memorable moments from Hanhwal." };

const posts = [
  { type: "Activity", title: "Korean Archery Experience with International Students", date: "Hanhwal activity story", description: "Sharing Korean traditional archery posture, safety, concentration, and cultural meaning with international students.", image: "/images/hanhwal-site/news.webp" },
  { type: "Practice", title: "Find us on the field", date: "Every Saturday", description: "Hanhwal members meet at the auxiliary archery field in Jeonju for weekly practice and community time.", image: "/images/hanhwal-site/field-1.webp" },
  { type: "Culture", title: "Learning the tradition together", date: "Hanhwal community", description: "We learn, practice, and preserve the tradition of Korean archery while building a welcoming community together.", image: "/images/hanhwal-site/hero.webp" }
];

export default function HanhwalActivitiesPage() {
  return <HanhwalPublicShell>
    <main>
      <section className={styles.activitiesHero}><div className={styles.activitiesHeroContent}><p className={styles.eyebrow}>LATEST NEWS</p><h1>News &amp; Activities</h1><p className={styles.activitiesIntro}>Stories, activities, achievements, and memorable moments from Hanhwal.</p></div></section>
      <section className={styles.activitiesSection}><div className={styles.postsGrid}>{posts.map((post) => <article className={styles.activityCard} key={post.title}>
        <div className={styles.activityCardImage}><Image src={post.image} alt={post.title} fill sizes="(max-width: 900px) 100vw, 33vw" /></div>
        <div className={styles.activityCardContent}><span className={styles.activityType}>{post.type}</span><h2>{post.title}</h2><time>{post.date}</time><p>{post.description}</p><Link href="/our-activities/hanhwal" className={styles.activityReadMore}>Back to Hanhwal →</Link></div>
      </article>)}</div></section>
    </main>
  </HanhwalPublicShell>;
}
