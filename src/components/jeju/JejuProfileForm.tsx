"use client";

import { Check, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { JejuShell } from "@/components/jeju/JejuShell";
import { readJejuResponse, splitKeywords } from "@/components/jeju/jeju-client";
import type { JejuProfile } from "@/lib/jeju/types";

type ProfileResponse = { profile: JejuProfile | null; user: { email: string; name: string } };

type FormState = {
  allergies: string;
  budgetPreference: "budget" | "moderate" | "premium";
  dietaryRestrictions: string;
  displayName: string;
  foodWantToTry: string;
  placesWantToVisit: string;
  preferredActivities: string;
  preferredFoods: string;
  seafoodPreference: "avoid" | "neutral" | "like";
  spicyFoodPreference: "none" | "mild" | "medium" | "high";
  vegan: boolean;
  vegetarian: boolean;
};

function toForm(profile: JejuProfile | null, name = ""): FormState {
  return {
    allergies: profile?.allergies.join(", ") ?? "",
    budgetPreference: profile?.budgetPreference ?? "moderate",
    dietaryRestrictions: profile?.dietaryRestrictions.join(", ") ?? "",
    displayName: profile?.displayName || name,
    foodWantToTry: profile?.foodWantToTry.join(", ") ?? "",
    placesWantToVisit: profile?.placesWantToVisit.join(", ") ?? "",
    preferredActivities: profile?.preferredActivities.join(", ") ?? "",
    preferredFoods: profile?.preferredFoods.join(", ") ?? "",
    seafoodPreference: profile?.seafoodPreference ?? "neutral",
    spicyFoodPreference: profile?.spicyFoodPreference ?? "medium",
    vegan: profile?.vegan ?? false,
    vegetarian: profile?.vegetarian ?? false
  };
}

export function JejuProfileForm() {
  const [form, setForm] = useState<FormState>(() => toForm(null));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    readJejuResponse<ProfileResponse>("/api/jeju/profile")
      .then((response) => setForm(toForm(response.profile, response.user.name)))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Your profile could not load."))
      .finally(() => setLoaded(true));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await readJejuResponse<ProfileResponse>("/api/jeju/profile", {
        body: JSON.stringify({
          allergies: splitKeywords(form.allergies),
          budgetPreference: form.budgetPreference,
          dietaryRestrictions: splitKeywords(form.dietaryRestrictions),
          displayName: form.displayName,
          foodWantToTry: splitKeywords(form.foodWantToTry),
          placesWantToVisit: splitKeywords(form.placesWantToVisit),
          preferredActivities: splitKeywords(form.preferredActivities),
          preferredFoods: splitKeywords(form.preferredFoods),
          seafoodPreference: form.seafoodPreference,
          spicyFoodPreference: form.spicyFoodPreference,
          vegan: form.vegan,
          vegetarian: form.vegetarian
        }),
        method: "PUT"
      });
      setMessage("Your My Journey preferences have been saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your profile could not save.");
    } finally { setSaving(false); }
  }

  return (
    <JejuShell title="Your journey preferences" description="This profile belongs only to My Journey. It helps Woohyukmon make safer and more useful Jeju suggestions.">
      <section className="mx-auto max-w-4xl border border-[#0d5962]/12 bg-white/82 p-4 sm:p-6">
        <div className="border-b border-[#0d5962]/12 pb-4"><p className="text-xs font-bold uppercase text-[#0d5962]">Private profile</p></div>
        {!loaded ? <div className="mt-5 h-80 animate-pulse bg-[#e6f2ee]" /> : <form onSubmit={save} className="mt-5 grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Public nickname" value={form.displayName} onChange={(displayName) => setForm({ ...form, displayName })} placeholder="How should your reviews appear?" /><Field label="Allergies" value={form.allergies} onChange={(allergies) => setForm({ ...form, allergies })} placeholder="e.g. peanuts, shellfish" /><Field label="Dietary restrictions" value={form.dietaryRestrictions} onChange={(dietaryRestrictions) => setForm({ ...form, dietaryRestrictions })} placeholder="e.g. halal, no pork" /><Field label="Foods you would like to try" value={form.foodWantToTry} onChange={(foodWantToTry) => setForm({ ...form, foodWantToTry })} placeholder="e.g. abalone, black pork" /><Field label="Places you want to visit" value={form.placesWantToVisit} onChange={(placesWantToVisit) => setForm({ ...form, placesWantToVisit })} placeholder="e.g. Dongmun Market, beaches" /><Field label="Preferred foods" value={form.preferredFoods} onChange={(preferredFoods) => setForm({ ...form, preferredFoods })} placeholder="e.g. spicy noodles, desserts" /><Field label="Preferred activities" value={form.preferredActivities} onChange={(preferredActivities) => setForm({ ...form, preferredActivities })} placeholder="e.g. hiking, museums, markets" /></div><div className="grid gap-4 sm:grid-cols-3"><Select label="Budget" value={form.budgetPreference} onChange={(budgetPreference) => setForm({ ...form, budgetPreference: budgetPreference as FormState["budgetPreference"] })} options={[['budget', 'Budget'], ['moderate', 'Moderate'], ['premium', 'Premium']]} /><Select label="Spicy food" value={form.spicyFoodPreference} onChange={(spicyFoodPreference) => setForm({ ...form, spicyFoodPreference: spicyFoodPreference as FormState["spicyFoodPreference"] })} options={[['none', 'Avoid'], ['mild', 'Mild'], ['medium', 'Medium'], ['high', 'High']]} /><Select label="Seafood" value={form.seafoodPreference} onChange={(seafoodPreference) => setForm({ ...form, seafoodPreference: seafoodPreference as FormState["seafoodPreference"] })} options={[['avoid', 'Avoid'], ['neutral', 'Neutral'], ['like', 'Like']]} /></div><div className="flex flex-wrap gap-5"><CheckBox label="Vegetarian" checked={form.vegetarian} onChange={(vegetarian) => setForm({ ...form, vegetarian })} /><CheckBox label="Vegan" checked={form.vegan} onChange={(vegan) => setForm({ ...form, vegan })} /></div><div className="flex flex-wrap items-center gap-3 border-t border-[#0d5962]/12 pt-5"><button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#0d5962] px-5 text-sm font-bold text-white transition hover:bg-[#073c44] disabled:opacity-60"><Save aria-hidden className="h-4 w-4" />{saving ? "Saving…" : "Save preferences"}</button>{message ? <p className="text-sm text-[#315b5f]">{message}</p> : null}</div></form>}
      </section>
    </JejuShell>
  );
}

function Field({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder: string; value: string }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-[#234e53]">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 w-full border border-[#0d5962]/20 bg-white px-3 text-sm text-[#073c44] outline-none transition focus:border-[#0d5962]" /><span className="mt-1 block text-[11px] text-[#698287]">Separate multiple items with commas.</span></label>;
}

function Select({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<[string, string]>; value: string }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-[#234e53]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full border border-[#0d5962]/20 bg-white px-3 text-sm text-[#073c44] outline-none focus:border-[#0d5962]">{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>;
}

function CheckBox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#315b5f]"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#0d5962]" />{checked ? <Check aria-hidden className="-ml-1 h-3.5 w-3.5 text-[#0d5962]" /> : null}{label}</label>;
}
