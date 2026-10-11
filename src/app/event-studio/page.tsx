import { CalendarRange } from "lucide-react";
import { EventArchiveWorkspace } from "@/components/event-archive/EventArchiveWorkspace";
import { getArchiveAccess } from "@/lib/eventArchive/access";
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
    const access = await getArchiveAccess();
    if (!access.email) {
      return <main className="mx-auto max-w-5xl px-5 py-16"><h1 className="font-serif text-4xl font-semibold">Event Studio</h1><p className="mt-5 text-muted">로그인해주세요. / Please sign in.</p></main>;
    }
    const studio = await getStudioAccess();
    return (
      <main className="bg-paper px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl space-y-8">
          <header className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wider text-brass">K_LINE Organizer Workspace</p>
            <h1 className="flex items-center gap-3 font-serif text-4xl font-semibold text-navy sm:text-5xl"><CalendarRange aria-hidden className="h-10 w-10" />Event Studio</h1>
          </header>
          <EventArchiveWorkspace access={access} canCreate={studio.manageableClubs.length > 0} />
        </div>
      </main>
    );
  } catch {
    return <main className="mx-auto max-w-5xl px-5 py-16"><h1 className="font-serif text-4xl font-semibold">Event Studio</h1><p className="mt-5 text-muted">로그인과 클럽 운영진 권한을 확인해주세요. / Sign in with an authorized club administrator account.</p></main>;
  }
}
