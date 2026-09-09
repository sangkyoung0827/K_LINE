import type { SectionDataMap } from "@/types/club-page";
import { safeLink } from "@/lib/club-page/validation";
import styles from "../club-page.module.css";

function ButtonLink({ url, label }: { url: string; label: string }) {
  if (!url || !label) return null;
  let href: string;
  try {
    href = safeLink(url);
  } catch {
    return null;
  }
  return (
    <a className={styles.cta} href={href} rel="noopener noreferrer">
      {label}
    </a>
  );
}
export function HeroRenderer({ data }: { data: SectionDataMap["hero"] }) {
  return (
    <section className={`${styles.band} ${styles.hero}`}>
      {data.imageUrl && (
        <img className={styles.heroImage} src={data.imageUrl} alt="" />
      )}
      <div
        className={`${styles.inner} ${data.imageUrl ? styles.heroOverlay : ""}`}
      >
        <h1>{data.title}</h1>
        <p>{data.subtitle}</p>
        <ButtonLink url={data.buttonUrl} label={data.buttonLabel} />
      </div>
    </section>
  );
}
export function AboutRenderer({ data }: { data: SectionDataMap["about"] }) {
  return (
    <section className={styles.band}>
      <div className={styles.inner}>
        <h2>{data.heading}</h2>
        <p>{data.body}</p>
      </div>
    </section>
  );
}
export function GalleryRenderer({ data }: { data: SectionDataMap["gallery"] }) {
  return (
    <section className={styles.band}>
      <div className={styles.inner}>
        <h2>{data.heading}</h2>
        <div className={styles.gallery}>
          {data.images.map((item, index) => (
            <figure key={index}>
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.caption} loading="lazy" />
              )}
              <figcaption>{item.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
export function ScheduleRenderer({
  data,
}: {
  data: SectionDataMap["schedule"];
}) {
  return (
    <section className={styles.band}>
      <div className={styles.inner}>
        <h2>{data.heading}</h2>
        <ul className={styles.schedule}>
          {data.items.map((item, index) => (
            <li key={index}>
              <span>{item.date}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
export function MembersRenderer({ data }: { data: SectionDataMap["members"] }) {
  return (
    <section className={styles.band}>
      <div className={styles.inner}>
        <h2>{data.heading}</h2>
        <div className={styles.members}>
          {data.members.map((item, index) => (
            <article key={index}>
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name} loading="lazy" />
              )}
              <small>{item.role}</small>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
export function RecruitRenderer({ data }: { data: SectionDataMap["recruit"] }) {
  return (
    <section className={`${styles.band} ${styles.recruit}`}>
      <div className={styles.inner}>
        <h2>{data.heading}</h2>
        <p>{data.description}</p>
        <ButtonLink url={data.buttonUrl} label={data.buttonLabel} />
      </div>
    </section>
  );
}
export function LinksRenderer({ data }: { data: SectionDataMap["links"] }) {
  return (
    <section className={styles.band}>
      <div className={styles.inner}>
        <h2>{data.heading}</h2>
        <ul className={styles.links}>
          {data.links.map((item, index) => (
            <li key={index}>
              <ButtonLink url={item.url} label={item.label} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
