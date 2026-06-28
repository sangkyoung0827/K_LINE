import type { Metadata } from "next";
import { listReadableAlumniNotices } from "@/lib/eccAlumni";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "ECC Alumni Notices",
  description: "Public and role-aware notices for the ECC Alumni network.",
  path: "/ecc-alumni/notices"
});

export default async function EccAlumniNoticesPage() {
  const notices = await listReadableAlumniNotices().catch(() => []);

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">ECC Alumni</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-ink">Alumni Notices</h1>
        <div className="mt-10 grid gap-5">
          {notices.length > 0 ? (
            notices.map((notice) => (
              <article key={notice.id} className="paper-panel p-6">
                <p className="text-xs font-semibold uppercase text-brass">
                  {notice.visibility ?? "public"} {notice.is_pinned ? "/ pinned" : ""}
                </p>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">{notice.title}</h2>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink/68">{notice.content}</p>
              </article>
            ))
          ) : (
            <p className="paper-panel p-6 text-sm text-ink/64">No public alumni notices yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
