import { CalendarRange } from "lucide-react";
import { EventArchiveWorkspace } from "@/components/event-archive/EventArchiveWorkspace";
import { getArchiveAccess } from "@/lib/eventArchive/access";
import { getStudioAccess } from "@/lib/eventStudio/access";
import { createNoIndexMetadata } from "@/lib/seo";
import { auth } from "@/auth";
import { isDeveloperEmail } from "@/lib/admin";
import Link from "next/link";
import { EventStudio } from "@/components/google-forms/EventStudio";

export const dynamic = "force-dynamic";
export const metadata = createNoIndexMetadata({
  title: "Event Studio | K_LINE",
  description: "Create personal events with notices and Google Forms",
  path: "/event-studio"
});

export default async function EventStudioHubPage() {
  const session = await auth();
  if (!session?.user?.email) return <main className="mx-auto max-w-5xl px-5 py-16"><h1 className="font-serif text-4xl font-semibold">Event Studio</h1><Link className="mt-6 inline-flex min-h-11 items-center bg-ink px-5 text-paper" href="/login?callbackUrl=%2Fevent-studio">로그인 / Sign in</Link></main>;
  try {
    const studio = await getStudioAccess();
    const access = isDeveloperEmail(session.user.email) ? await getArchiveAccess() : null;
    return (
      <main className="bg-paper px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl space-y-8">
          <header className="space-y-4">
            <h1 className="flex items-center gap-3 font-serif text-4xl font-semibold text-navy sm:text-5xl"><CalendarRange aria-hidden className="h-10 w-10" />Event Studio</h1>
          </header>
          {access ? <EventArchiveWorkspace access={access} canCreate={studio.manageableClubs.length > 0} /> : <EventStudio />}
        </div>
      </main>
    );
  } catch {
    return <main className="mx-auto max-w-5xl px-5 py-16"><h1 className="font-serif text-4xl font-semibold">Event Studio</h1><p className="mt-5 text-muted">행사 제작 화면에 연결하지 못했습니다. 잠시 후 다시 시도해주세요. / The event workspace is temporarily unavailable.</p></main>;
  }
}
