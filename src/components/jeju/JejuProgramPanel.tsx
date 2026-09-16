"use client";

import { ClipboardCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GoogleFormApplicationLink } from "@/components/google-forms/GoogleFormApplicationLink";
import { JejuShell } from "@/components/jeju/JejuShell";
import { formatJejuDate, readJejuResponse } from "@/components/jeju/jeju-client";
import type { JejuAccess, JejuProgram } from "@/lib/jeju/types";

type ProgramResponse = { access: JejuAccess; programs: JejuProgram[] };

export function JejuProgramPanel() {
  const [data, setData] = useState<ProgramResponse | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { void readJejuResponse<ProgramResponse>("/api/jeju/programs").then(setData).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Programs could not load.")); }, []);
  return <JejuShell title="Jeju Program" description="Program details remain in K_LINE. New applications are submitted only through Google Forms." actions={data?.access.isAdmin ? <div className="flex flex-wrap gap-2"><Link href="/admin/jeju" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0d5962] px-4 text-sm font-bold text-white">Manage programs</Link><Link href="/admin/google-forms" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#0d5962]/25 bg-white px-4 text-sm font-bold text-[#0d5962]">Google Forms</Link></div> : undefined}>
    <div className="grid gap-4">{message ? <div className="border border-[#0d5962]/16 bg-[#e8f4ef] px-4 py-3 text-sm text-[#234e53]">{message}</div> : null}{!data ? <div className="h-64 animate-pulse bg-[#d7ebe6]" /> : data.programs.length ? <div className="grid gap-4 lg:grid-cols-2">{data.programs.map((program) => <ProgramCard key={program.id} program={program} />)}</div> : <section className="grid min-h-72 place-items-center border border-dashed border-[#0d5962]/22 bg-white/62 px-5 text-center"><div className="max-w-md"><UsersRound aria-hidden className="mx-auto h-7 w-7 text-[#0d5962]" /><h2 className="mt-3 font-serif text-2xl font-semibold text-[#073c44]">No program is open yet.</h2><p className="mt-2 text-sm leading-6 text-[#4c6769]">When Jeju Explorer opens the next semester program, it will appear here.</p></div></section>}</div>
  </JejuShell>;
}

function ProgramCard({ program }: { program: JejuProgram }) {
  return <article className="border border-[#0d5962]/12 bg-white/82 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase text-[#0d5962]">{program.semester}</span><h2 className="mt-1 font-serif text-2xl font-semibold text-[#073c44]">{program.titleEn || program.title}</h2>{program.titleEn && program.title !== program.titleEn ? <p className="mt-1 text-sm text-[#4c6769]">{program.title}</p> : null}</div><span className={`px-2 py-1 text-xs font-bold uppercase ${program.status === "open" ? "bg-[#e4f0d8] text-[#3e6a43]" : "bg-[#edf0ef] text-[#5f6f70]"}`}>{program.status}</span></div><p className="mt-4 text-sm leading-6 text-[#315b5f]">{program.descriptionEn || program.description || "Jeju Explorer program details will be confirmed by the organizer."}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><ProgramFact label="Participants" value={`${program.capacityMin}–${program.capacityMax}`} />{program.startsAt ? <ProgramFact label="Starts" value={formatJejuDate(program.startsAt)} /> : null}{program.meetingPlace ? <ProgramFact label="Meeting" value={program.meetingPlace} /> : null}</dl>{program.myApplication ? <p className="mt-4 inline-flex items-center gap-2 bg-[#e8f4ef] px-3 py-2 text-sm font-semibold text-[#315b5f]"><ClipboardCheck aria-hidden className="h-4 w-4" /> Historical K_LINE application: {program.myApplication.status}</p> : null}{program.status === "open" ? <div className="mt-5"><GoogleFormApplicationLink activityId={program.id} clubKey="jeju" language="en" className="w-full rounded-xl" /></div> : null}</article>;
}

function ProgramFact({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase text-[#567578]">{label}</dt><dd className="mt-1 text-[#234e53]">{value}</dd></div>; }
