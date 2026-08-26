"use client";

import { ListChecks, MapPinned, Navigation } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { JejuMapCanvas } from "@/components/jeju/JejuMapCanvas";
import { JejuShell } from "@/components/jeju/JejuShell";
import { formatJejuDate, placeTitle, readJejuResponse } from "@/components/jeju/jeju-client";
import type { JejuExplorerOverview } from "@/lib/jeju/types";

type OverviewResponse = JejuExplorerOverview & { user: { image: string; name: string } };

export function JejuMapPageClient() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    readJejuResponse<OverviewResponse>("/api/jeju/overview").then(setOverview).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load your map."));
  }, []);

  const visitedPlaces = useMemo(() => {
    if (!overview) return [];
    const byId = new Map(overview.places.map((place) => [place.id, place]));
    return overview.visits.map((visit) => ({ place: byId.get(visit.placeId), visit })).filter((item) => item.place);
  }, [overview]);

  return (
    <JejuShell title="My Jeju Map" description="A private map of the places you have checked in to, with the broader Jeju Explorer map around it.">
      {error ? <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {!overview && !error ? <div className="min-h-[420px] animate-pulse bg-[#c7e7e2]" /> : null}
      {overview ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,.85fr)] lg:gap-7">
          <div>
            <JejuMapCanvas places={overview.places} visitedPlaceIds={overview.visits.map((visit) => visit.placeId)} />
            <p className="mt-3 inline-flex items-start gap-2 text-xs leading-5 text-[#4c6769]"><Navigation aria-hidden className="mt-0.5 h-4 w-4 text-[#0d5962]" /> Check-in asks for location only after you tap the button at a place. K_LINE does not track your location in the background.</p>
          </div>
          <aside className="border border-[#0d5962]/12 bg-white/78 p-4 sm:p-5">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase text-[#0d5962]"><ListChecks aria-hidden className="h-4 w-4" /> Your explorer record</span>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Summary label="Places" value={overview.stats.placesExplored} />
              <Summary label="Visits" value={overview.visits.length} />
              <Summary label="Food stops" value={overview.stats.restaurants} />
              <Summary label="Nature & culture" value={overview.stats.attractions} />
            </div>
            <Link href="/jeju/discover" className="mt-4 inline-flex min-h-11 w-full items-center justify-center bg-[#0d5962] px-4 text-sm font-bold text-white transition hover:bg-[#073c44]">Discover a new place</Link>
          </aside>

          <section className="border-t border-[#0d5962]/12 pt-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-2xl font-semibold text-[#073c44]">Visit timeline</h2><Link href="/jeju/memories" className="text-sm font-bold text-[#0d5962]">Open memories</Link></div>
            {visitedPlaces.length > 0 ? (
              <div className="grid gap-2">
                {visitedPlaces.slice(0, 20).map(({ place, visit }) => place ? (
                  <Link key={visit.id} href={`/jeju/place/${place.id}`} className="flex items-center justify-between gap-4 border border-[#0d5962]/12 bg-white/74 px-4 py-3 transition hover:border-[#0d5962]/38 hover:bg-white">
                    <span className="min-w-0"><strong className="block truncate text-sm text-[#073c44]">{placeTitle(place)}</strong><span className="mt-1 block text-xs text-[#4c6769]">{place.category.replace("_", " ")}</span></span>
                    <time className="shrink-0 text-xs text-[#4c6769]">{formatJejuDate(visit.visitedAt)}</time>
                  </Link>
                ) : null)}
              </div>
            ) : <div className="border border-dashed border-[#0d5962]/22 bg-white/55 px-5 py-8 text-sm leading-6 text-[#4c6769]">Your visit timeline will start after your first check-in.</div>}
          </section>
        </div>
      ) : null}
    </JejuShell>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="bg-[#e7f3ef] px-3 py-3"><p className="text-[11px] font-bold uppercase text-[#527579]">{label}</p><p className="mt-1 text-2xl font-semibold text-[#073c44]">{value}</p></div>;
}
