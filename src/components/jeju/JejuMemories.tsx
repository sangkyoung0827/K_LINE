"use client";

import { BookOpenText, MapPinned, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { JejuShell } from "@/components/jeju/JejuShell";
import { formatJejuDate, placeTitle, readJejuResponse } from "@/components/jeju/jeju-client";
import type { JejuMemory } from "@/lib/jeju/types";

type MemoryResponse = { memories: JejuMemory[] };

export function JejuMemories() {
  const [memories, setMemories] = useState<JejuMemory[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    readJejuResponse<MemoryResponse>("/api/jeju/memories").then((response) => setMemories(response.memories)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Your memories could not load."));
  }, []);

  const summary = useMemo(() => {
    const places = new Set(memories.map((memory) => memory.placeId).filter(Boolean));
    const dated = memories.map((memory) => new Date(memory.createdAt)).filter((date) => !Number.isNaN(date.getTime()));
    const first = dated.length ? Math.min(...dated.map((date) => date.getTime())) : 0;
    const days = first ? Math.max(1, Math.ceil((Date.now() - first) / 86_400_000)) : 0;
    return { days, places: places.size, photos: memories.reduce((total, memory) => total + memory.photos.length, 0) };
  }, [memories]);

  return (
    <JejuShell title="My Jeju Journey" description="A private memory log made from your verified check-ins and reviews.">
      {error ? <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      <section className="grid gap-3 sm:grid-cols-3"><MemoryStat label="Days in your log" value={summary.days} /><MemoryStat label="Places visited" value={summary.places} /><MemoryStat label="Photos shared" value={summary.photos} /></section>
      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]">
        <div className="border border-[#0d5962]/12 bg-white/80 p-4 sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase text-[#0d5962]">Timeline</p><h2 className="mt-1 font-serif text-2xl font-semibold text-[#073c44]">Your recorded visits</h2></div><MapPinned aria-hidden className="h-5 w-5 text-[#0d5962]" /></div>{memories.length > 0 ? <div className="mt-5 grid gap-3">{memories.map((memory) => <Link key={memory.id} href={memory.place ? `/jeju/place/${memory.place.id}` : "/jeju/map"} className="group grid gap-3 border border-[#0d5962]/10 bg-[#f9fdfb] p-3 transition hover:border-[#0d5962]/35 sm:grid-cols-[6rem_1fr]">{memory.photos[0] ? <img src={memory.photos[0].publicUrl} alt="" className="aspect-square h-24 w-24 object-cover" /> : <div className="grid aspect-square h-24 w-24 place-items-center bg-[#dcefe8] text-xs font-bold text-[#0d5962]">JEJU</div>}<div className="min-w-0"><time className="text-xs font-semibold text-[#4c6769]">{formatJejuDate(memory.createdAt)}</time><h3 className="mt-1 truncate font-serif text-xl font-semibold text-[#073c44]">{memory.place ? placeTitle(memory.place) : memory.title || "Jeju memory"}</h3>{memory.rating ? <span className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-[#a66e1d]"><Star aria-hidden className="h-4 w-4 fill-current" />{memory.rating} / 5</span> : null}{memory.note ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#4c6769]">{memory.note}</p> : null}</div></Link>)}</div> : <div className="mt-5 border border-dashed border-[#0d5962]/22 bg-[#f9fdfb] px-5 py-10 text-center text-sm leading-6 text-[#4c6769]">Your Jeju memory log will begin after your first verified check-in.<div><Link href="/jeju/discover" className="mt-4 inline-flex font-bold text-[#0d5962]">Discover places</Link></div></div>}</div>
        <aside className="border border-[#0d5962]/12 bg-[#073c44] p-5 text-white"><BookOpenText aria-hidden className="h-6 w-6 text-[#f0c56b]" /><h2 className="mt-4 font-serif text-2xl font-semibold">Memory Log</h2><p className="mt-2 text-sm leading-6 text-white/74">The current MVP keeps a screen-ready record of your journey. PDF export is deliberately prepared as a later step, after real visit data has accumulated.</p><div className="mt-5 border border-white/15 bg-white/5 p-4 text-sm leading-6 text-white/78"><strong className="block text-white">Your log will include</strong><span className="mt-2 block">Visited places, dates, review ratings, photos, favorite places, and a journey timeline.</span></div></aside>
      </section>
    </JejuShell>
  );
}

function MemoryStat({ label, value }: { label: string; value: number }) {
  return <div className="border border-[#0d5962]/12 bg-white/78 px-4 py-4"><p className="text-xs font-bold uppercase text-[#567578]">{label}</p><p className="mt-1 font-serif text-3xl font-semibold text-[#073c44]">{value}</p></div>;
}
