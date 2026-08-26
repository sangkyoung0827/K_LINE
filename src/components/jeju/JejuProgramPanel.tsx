"use client";

import { CalendarDays, ClipboardCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { JejuShell } from "@/components/jeju/JejuShell";
import { formatJejuDate, readJejuResponse, splitKeywords } from "@/components/jeju/jeju-client";
import type { JejuAccess, JejuProgram } from "@/lib/jeju/types";

type ProgramResponse = { access: JejuAccess; programs: JejuProgram[] };
type ApplicationForm = {
  allergies: string;
  attractionsWantToVisit: string;
  budgetPreference: string;
  dietaryRestrictions: string;
  foodPreferences: string;
  foodsWantToTry: string;
  interestedActivities: string;
  restaurantsWantToVisit: string;
  seafoodPreference: string;
  spicyFoodTolerance: string;
};

function blankForm(): ApplicationForm {
  return { allergies: "", attractionsWantToVisit: "", budgetPreference: "moderate", dietaryRestrictions: "", foodPreferences: "", foodsWantToTry: "", interestedActivities: "", restaurantsWantToVisit: "", seafoodPreference: "neutral", spicyFoodTolerance: "medium" };
}

export function JejuProgramPanel() {
  const [data, setData] = useState<ProgramResponse | null>(null);
  const [openProgramId, setOpenProgramId] = useState("");
  const [form, setForm] = useState<ApplicationForm>(blankForm);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => readJejuResponse<ProgramResponse>("/api/jeju/programs").then(setData).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Programs could not load."));
  useEffect(() => { void load(); }, []);

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openProgramId) return;
    setSubmitting(true);
    setMessage("");
    try {
      await readJejuResponse(`/api/jeju/programs/${openProgramId}/applications`, { body: JSON.stringify({ ...form, allergies: splitKeywords(form.allergies), attractionsWantToVisit: splitKeywords(form.attractionsWantToVisit), dietaryRestrictions: splitKeywords(form.dietaryRestrictions), foodPreferences: splitKeywords(form.foodPreferences), foodsWantToTry: splitKeywords(form.foodsWantToTry), interestedActivities: splitKeywords(form.interestedActivities), restaurantsWantToVisit: splitKeywords(form.restaurantsWantToVisit) }), method: "POST" });
      setMessage("Your Jeju Explorer program application has been saved.");
      setOpenProgramId("");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Your application could not be saved."); } finally { setSubmitting(false); }
  }

  return <JejuShell title="Jeju Program" description="Apply to the semester-based ‘Jeju Explorer’ program. Your existing K_LINE login is used; Jeju preferences can be added or updated with this application." actions={data?.access.isAdmin ? <Link href="/admin/jeju" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0d5962] px-4 text-sm font-bold text-white">Manage programs</Link> : undefined}><div className="grid gap-4">{message ? <div className="border border-[#0d5962]/16 bg-[#e8f4ef] px-4 py-3 text-sm text-[#234e53]">{message}</div> : null}{!data ? <div className="h-64 animate-pulse bg-[#d7ebe6]" /> : data.programs.length > 0 ? <div className="grid gap-4 lg:grid-cols-2">{data.programs.map((program) => <ProgramCard key={program.id} program={program} open={openProgramId === program.id} onOpen={() => { setOpenProgramId(program.id); setForm(blankForm()); setMessage(""); }} onClose={() => setOpenProgramId("")} form={form} setForm={setForm} submitting={submitting} submit={apply} />)}</div> : <section className="grid min-h-72 place-items-center border border-dashed border-[#0d5962]/22 bg-white/62 px-5 text-center"><div className="max-w-md"><UsersRound aria-hidden className="mx-auto h-7 w-7 text-[#0d5962]" /><h2 className="mt-3 font-serif text-2xl font-semibold text-[#073c44]">No program is open yet.</h2><p className="mt-2 text-sm leading-6 text-[#4c6769]">When Jeju Explorer opens the next semester program, the application will appear here.</p></div></section>}</div></JejuShell>;
}

function ProgramCard({ form, onClose, onOpen, open, program, setForm, submit, submitting }: { form: ApplicationForm; onClose: () => void; onOpen: () => void; open: boolean; program: JejuProgram; setForm: (value: ApplicationForm) => void; submit: (event: FormEvent<HTMLFormElement>) => void; submitting: boolean }) {
  const applyable = program.status === "open";
  return <article className="border border-[#0d5962]/12 bg-white/82 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase text-[#0d5962]">{program.semester}</span><h2 className="mt-1 font-serif text-2xl font-semibold text-[#073c44]">{program.titleEn || program.title}</h2>{program.titleEn && program.title !== program.titleEn ? <p className="mt-1 text-sm text-[#4c6769]">{program.title}</p> : null}</div><span className={`px-2 py-1 text-xs font-bold uppercase ${program.status === "open" ? "bg-[#e4f0d8] text-[#3e6a43]" : "bg-[#edf0ef] text-[#5f6f70]"}`}>{program.status}</span></div><p className="mt-4 text-sm leading-6 text-[#315b5f]">{program.descriptionEn || program.description || "Jeju Explorer program details will be confirmed by the organizer."}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><ProgramFact label="Participants" value={`${program.capacityMin}–${program.capacityMax}`} />{program.startsAt ? <ProgramFact label="Starts" value={formatJejuDate(program.startsAt)} /> : null}{program.meetingPlace ? <ProgramFact label="Meeting" value={program.meetingPlace} /> : null}</dl>{program.myApplication ? <p className="mt-4 inline-flex items-center gap-2 bg-[#e8f4ef] px-3 py-2 text-sm font-semibold text-[#315b5f]"><ClipboardCheck aria-hidden className="h-4 w-4" /> Application status: {program.myApplication.status}</p> : null}{applyable && !open ? <button type="button" onClick={onOpen} className="mt-5 inline-flex min-h-11 w-full items-center justify-center bg-[#0d5962] px-4 text-sm font-bold text-white transition hover:bg-[#073c44]">Apply to this program</button> : null}{open ? <form onSubmit={submit} className="mt-5 grid gap-3 border-t border-[#0d5962]/12 pt-5"><p className="text-sm font-semibold text-[#073c44]">Application preferences</p><div className="grid gap-3 sm:grid-cols-2"><ApplicationField label="Allergies" value={form.allergies} onChange={(allergies) => setForm({ ...form, allergies })} /><ApplicationField label="Dietary restrictions" value={form.dietaryRestrictions} onChange={(dietaryRestrictions) => setForm({ ...form, dietaryRestrictions })} /><ApplicationField label="Food preferences" value={form.foodPreferences} onChange={(foodPreferences) => setForm({ ...form, foodPreferences })} /><ApplicationField label="Foods to try" value={form.foodsWantToTry} onChange={(foodsWantToTry) => setForm({ ...form, foodsWantToTry })} /><ApplicationField label="Restaurants to visit" value={form.restaurantsWantToVisit} onChange={(restaurantsWantToVisit) => setForm({ ...form, restaurantsWantToVisit })} /><ApplicationField label="Attractions to visit" value={form.attractionsWantToVisit} onChange={(attractionsWantToVisit) => setForm({ ...form, attractionsWantToVisit })} /><ApplicationField label="Interested activities" value={form.interestedActivities} onChange={(interestedActivities) => setForm({ ...form, interestedActivities })} /></div><div className="grid gap-3 sm:grid-cols-3"><SmallSelect label="Budget" value={form.budgetPreference} options={[['budget', 'Budget'], ['moderate', 'Moderate'], ['premium', 'Premium']]} onChange={(budgetPreference) => setForm({ ...form, budgetPreference })} /><SmallSelect label="Spicy food" value={form.spicyFoodTolerance} options={[['none', 'Avoid'], ['mild', 'Mild'], ['medium', 'Medium'], ['high', 'High']]} onChange={(spicyFoodTolerance) => setForm({ ...form, spicyFoodTolerance })} /><SmallSelect label="Seafood" value={form.seafoodPreference} options={[['avoid', 'Avoid'], ['neutral', 'Neutral'], ['like', 'Like']]} onChange={(seafoodPreference) => setForm({ ...form, seafoodPreference })} /></div><div className="flex gap-2"><button type="submit" disabled={submitting} className="min-h-10 bg-[#0d5962] px-4 text-sm font-bold text-white disabled:opacity-60">{submitting ? "Saving…" : "Submit application"}</button><button type="button" onClick={onClose} className="min-h-10 border border-[#0d5962]/24 bg-white px-4 text-sm font-semibold text-[#315b5f]">Cancel</button></div></form> : null}</article>;
}

function ProgramFact({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase text-[#567578]">{label}</dt><dd className="mt-1 text-[#234e53]">{value}</dd></div>; }
function ApplicationField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) { return <label><span className="mb-1 block text-xs font-semibold text-[#315b5f]">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Separate items with commas" className="min-h-10 w-full border border-[#0d5962]/20 bg-white px-3 text-sm text-[#073c44] outline-none focus:border-[#0d5962]" /></label>; }
function SmallSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<[string, string]>; value: string }) { return <label><span className="mb-1 block text-xs font-semibold text-[#315b5f]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-10 w-full border border-[#0d5962]/20 bg-white px-3 text-sm text-[#073c44] outline-none focus:border-[#0d5962]">{options.map(([key, option]) => <option key={key} value={key}>{option}</option>)}</select></label>; }
