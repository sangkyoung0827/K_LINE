import Link from "next/link";
import { Archive, ArrowUpRight, CalendarRange, FileText } from "lucide-react";
import { EventStudio } from "@/components/google-forms/EventStudio";
import { getStudioAccess } from "@/lib/eventStudio/access";
import { createNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = createNoIndexMetadata({
  title: "Event Studio | K_LINE",
  description: "Administrator event creation and event resource entry point",
  path: "/event-studio"
});

export default async function EventStudioHubPage() {
  try {
    const access = await getStudioAccess();
    if (!access.manageableClubs.length) {
      return <main className="mx-auto max-w-5xl px-5 py-16"><h1 className="font-serif text-4xl font-semibold">Event Studio</h1><p className="mt-5 text-muted">클럽 운영진 권한이 필요합니다. / Club administrator access required.</p></main>;
    }
    return (
      <main className="bg-paper px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl space-y-8">
          <header className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wider text-brass">K_LINE Organizer Workspace</p>
            <h1 className="flex items-center gap-3 font-serif text-4xl font-semibold text-navy sm:text-5xl"><CalendarRange aria-hidden className="h-10 w-10" />Event Studio</h1>
            <p className="max-w-3xl text-sm leading-7 text-muted">우혁몬으로 행사와 한·영 공지, Google Forms 신청폼을 설계하고 승인합니다. 아래 자료실에서는 기존 행사 자료를 확인할 수 있습니다.</p>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-navy/10 bg-white p-5">
              <div className="flex items-center gap-2 text-navy"><FileText aria-hidden className="h-5 w-5" /><h2 className="font-semibold">AI Event Creator</h2></div>
              <p className="mt-2 text-sm leading-6 text-muted">현재 운영 중인 Event Studio의 행사 기획, 공지 및 구글폼 검토 기능입니다.</p>
              <a href="#event-creator" className="mt-4 inline-flex items-center gap-2 font-semibold text-navy underline underline-offset-4">행사 만들기 <ArrowUpRight aria-hidden className="h-4 w-4" /></a>
            </section>
            <section className="rounded-xl border border-navy/10 bg-white p-5">
              <div className="flex items-center gap-2 text-navy"><Archive aria-hidden className="h-5 w-5" /><h2 className="font-semibold">Event Archive</h2></div>
              <p className="mt-2 text-sm leading-6 text-muted">통합 공지·포스터 아카이브는 준비 중입니다. 현재는 기존 ECC 자료실에서 업로드된 행사 자료를 확인할 수 있습니다.</p>
              {access.manageableClubs.includes("ecc") ? (
                <Link href="/our-activities/ecc/resources" className="mt-4 inline-flex items-center gap-2 font-semibold text-navy underline underline-offset-4">ECC 자료실 열기 <ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
              ) : <p className="mt-4 text-xs text-muted">클럽별 통합 아카이브는 아직 제공되지 않습니다.</p>}
            </section>
          </div>
          <section id="event-creator" aria-label="AI Event Creator">
            <EventStudio />
          </section>
        </div>
      </main>
    );
  } catch {
    return <main className="mx-auto max-w-5xl px-5 py-16"><h1 className="font-serif text-4xl font-semibold">Event Studio</h1><p className="mt-5 text-muted">로그인과 클럽 운영진 권한을 확인해주세요. / Sign in with an authorized club administrator account.</p></main>;
  }
}
