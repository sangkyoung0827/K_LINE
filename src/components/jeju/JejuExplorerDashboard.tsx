"use client";

import { ArrowRight, Bot, Compass, MapPinned, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { JejuMapCanvas } from "@/components/jeju/JejuMapCanvas";
import { JejuShell } from "@/components/jeju/JejuShell";
import { placeTitle, readJejuResponse } from "@/components/jeju/jeju-client";
import type { JejuExplorerOverview } from "@/lib/jeju/types";

type OverviewResponse = JejuExplorerOverview & { user: { image: string; name: string } };

const actions = [
  { href: "/jeju/map", icon: MapPinned, title: "My Jeju Map", description: "See places you explored and places waiting for you." },
  { href: "/jeju/discover", icon: Compass, title: "Discover", description: "Find confirmed local places by taste, type, and needs." },
  { href: "/jeju/ai", icon: Bot, title: "Ask Woohyukmon", description: "Get a Jeju suggestion built from your profile and map." },
  { href: "/jeju/memories", icon: Sparkles, title: "My Memories", description: "Keep the visits and reviews that make up your journey." },
  { href: "/jeju/program", icon: UsersRound, title: "Jeju Program", description: "Apply to a semester-based Jeju Explorer program." }
];

export function JejuExplorerDashboard() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    readJejuResponse<OverviewResponse>("/api/jeju/overview")
      .then(setOverview)
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Jeju Explorer could not load."));
  }, []);

  const visitedIds = overview?.visits.map((visit) => visit.placeId) ?? [];

  return (
    <JejuShell
      title="Jeju Explorer"
      description="Explore Jeju, record your journey, and discover places that match your taste."
      actions={<Link href="/jeju/profile" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0d5962] px-4 text-sm font-bold text-white transition hover:bg-[#073c44]">Set my preferences</Link>}
    >
      {error ? <ErrorNotice message={error} /> : null}
      {!overview && !error ? <DashboardLoading /> : null}
      {overview ? (
        <div className="grid gap-5 lg:gap-7">
          {!overview.profile ? (
            <section className="border border-[#d49b42]/40 bg-[#fff8e9] p-4 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5">
              <div>
                <p className="font-semibold text-[#5d420f]">Make recommendations safer and more personal.</p>
                <p className="mt-1 text-sm leading-6 text-[#765c26]">Add food preferences, allergies, budget, and places you want to explore.</p>
              </div>
              <Link href="/jeju/profile" className="mt-3 inline-flex min-h-10 items-center justify-center bg-[#d49b42] px-4 text-sm font-bold text-[#18383d] transition hover:bg-[#c68b30] sm:mt-0">Create profile</Link>
            </section>
          ) : null}

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,.85fr)] lg:gap-7">
            <JejuMapCanvas places={overview.places} visitedPlaceIds={visitedIds} />
            <div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Stat title="Places explored" value={overview.stats.placesExplored} />
              <Stat title="Restaurants & cafes" value={overview.stats.restaurants} />
              <Stat title="Attractions" value={overview.stats.attractions} />
              <Stat title="Hidden spots" value={overview.stats.hiddenSpots} />
              {overview.access.isAdmin ? (
                <Link href="/admin/jeju" className="col-span-full inline-flex min-h-12 items-center justify-between border border-[#0d5962]/20 bg-white px-4 text-sm font-bold text-[#073c44] transition hover:border-[#0d5962] hover:bg-[#e8f4ef]">
                  Jeju administrator workspace <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-[#0d5962]">Start here</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-[#073c44]">Your Jeju toolkit</h2>
              </div>
              <Link href="/jeju/discover" className="text-sm font-bold text-[#0d5962] hover:text-[#073c44]">Browse places</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.href} href={action.href} className="group flex min-h-40 flex-col border border-[#0d5962]/12 bg-white/82 p-4 transition hover:-translate-y-0.5 hover:border-[#0d5962]/40 hover:shadow-[0_14px_30px_rgba(13,89,98,0.10)]">
                    <Icon aria-hidden className="h-5 w-5 text-[#0d5962]" />
                    <h3 className="mt-5 font-semibold text-[#073c44]">{action.title}</h3>
                    <p className="mt-1 text-sm leading-5 text-[#4c6769]">{action.description}</p>
                    <ArrowRight aria-hidden className="mt-auto h-4 w-4 text-[#0d5962] transition group-hover:translate-x-1" />
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="border-t border-[#0d5962]/12 pt-5">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-[#0d5962]">Jeju National University Global Map</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-[#073c44]">Latest confirmed places</h2>
              </div>
              <span className="text-sm text-[#4c6769]">{overview.places.length} places</span>
            </div>
            {overview.places.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {overview.places.slice(0, 6).map((place) => (
                  <Link key={place.id} href={`/jeju/place/${place.id}`} className="group flex min-h-28 items-center gap-3 border border-[#0d5962]/12 bg-white/80 p-3 transition hover:border-[#0d5962]/40">
                    {place.thumbnailUrl ? <img src={place.thumbnailUrl} alt="" className="h-20 w-20 shrink-0 object-cover" /> : <span className="grid h-20 w-20 shrink-0 place-items-center bg-[#d9ece3] text-xs font-bold text-[#0d5962]">JEJU</span>}
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-[#073c44]">{placeTitle(place)}</strong>
                      <span className="mt-1 block text-xs text-[#4c6769]">{place.category.replace("_", " ")}</span>
                      {place.reviewCount > 0 ? <span className="mt-1 block text-xs font-semibold text-[#a66e1d]">{place.averageRating.toFixed(1)} / 5</span> : null}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-[#0d5962]/22 bg-white/55 px-5 py-8 text-sm leading-6 text-[#4c6769]">No real places have been added yet. Jeju administrators can add confirmed locations from the Jeju workspace.</div>
            )}
          </section>
        </div>
      ) : null}
    </JejuShell>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return <div className="border border-[#0d5962]/12 bg-white/76 px-4 py-4"><p className="text-xs font-semibold uppercase text-[#567578]">{title}</p><p className="mt-1 font-serif text-3xl font-semibold text-[#073c44]">{value}</p></div>;
}

function ErrorNotice({ message }: { message: string }) {
  return <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{message}</div>;
}

function DashboardLoading() {
  return <div className="grid gap-4 lg:grid-cols-[1.55fr_.85fr]"><div className="min-h-[420px] animate-pulse bg-[#c7e7e2]" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse bg-white/65" />)}</div></div>;
}
