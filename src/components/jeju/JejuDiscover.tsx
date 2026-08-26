"use client";

import { LocateFixed, Search, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { JejuShell } from "@/components/jeju/JejuShell";
import { jejuCategoryLabels, placeTitle, readJejuResponse } from "@/components/jeju/jeju-client";
import { getDistanceInMeters } from "@/lib/jeju/checkin";
import { jejuPlaceCategories, type JejuPlace, type JejuPlaceCategory } from "@/lib/jeju/types";

type PlacesResponse = { places: JejuPlace[] };
type Position = { latitude: number; longitude: number };
type SortKind = "recommended" | "rating" | "nearest" | "reviews" | "newest";

export function JejuDiscover() {
  const [places, setPlaces] = useState<JejuPlace[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<JejuPlaceCategory | "all">("all");
  const [minimumRating, setMinimumRating] = useState<0 | 3 | 4 | 4.5>(0);
  const [priceRange, setPriceRange] = useState<"all" | "budget" | "moderate" | "premium">("all");
  const [vegetarianOnly, setVegetarianOnly] = useState(false);
  const [veganOnly, setVeganOnly] = useState(false);
  const [spicyOnly, setSpicyOnly] = useState(false);
  const [seafoodOnly, setSeafoodOnly] = useState(false);
  const [englishOnly, setEnglishOnly] = useState(false);
  const [sort, setSort] = useState<SortKind>("recommended");
  const [position, setPosition] = useState<Position | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    readJejuResponse<PlacesResponse>("/api/jeju/places").then((response) => setPlaces(response.places)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Places could not load."));
  }, []);

  function shareLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("This browser does not support location.");
      return;
    }
    setLocationMessage("Getting your location for this sorting request…");
    navigator.geolocation.getCurrentPosition(
      (current) => {
        setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        setSort("nearest");
        setLocationMessage("Nearest places are shown using your current location. It was not saved.");
      },
      () => setLocationMessage("Location was not shared. You can still browse all places."),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }
    );
  }

  const filteredPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = places.filter((place) => {
      const matchesQuery = !normalizedQuery || [place.name, place.nameEn, place.address, place.description, place.descriptionEn, ...place.tags].join(" ").toLowerCase().includes(normalizedQuery);
      const placeKeywords = [...place.tags, ...place.foodFeatures, ...place.recommendedMenu].join(" ").toLowerCase();
      const hasSpicyFood = placeKeywords.includes("spicy") || placeKeywords.includes("매운") || placeKeywords.includes("매콤");
      const hasSeafood = placeKeywords.includes("seafood") || placeKeywords.includes("fish") || placeKeywords.includes("해산물") || placeKeywords.includes("수산");
      return matchesQuery
        && (category === "all" || place.category === category)
        && (minimumRating === 0 || place.averageRating >= minimumRating)
        && (priceRange === "all" || place.priceRange === priceRange)
        && (!vegetarianOnly || place.vegetarianSupported)
        && (!veganOnly || place.veganSupported)
        && (!spicyOnly || hasSpicyFood)
        && (!seafoodOnly || hasSeafood)
        && (!englishOnly || place.englishFriendly);
    });
    return [...filtered].sort((left, right) => {
      if (sort === "nearest" && position) return getDistanceInMeters(position, left) - getDistanceInMeters(position, right);
      if (sort === "rating") return right.averageRating - left.averageRating || right.reviewCount - left.reviewCount;
      if (sort === "reviews") return right.reviewCount - left.reviewCount || right.averageRating - left.averageRating;
      if (sort === "newest") return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return right.recommendationPercentage - left.recommendationPercentage || right.averageRating - left.averageRating || right.reviewCount - left.reviewCount;
    });
  }, [category, englishOnly, minimumRating, places, position, priceRange, query, seafoodOnly, sort, spicyOnly, veganOnly, vegetarianOnly]);

  return (
    <JejuShell title="Discover Jeju" description="Browse confirmed places submitted to the K_LINE Jeju Explorer map by community members.">
      <div className="grid gap-4">
        <section className="border border-[#0d5962]/12 bg-white/78 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative block min-w-0 flex-1"><Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#547477]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search places, food, neighbourhoods" className="min-h-11 w-full border border-[#0d5962]/20 bg-white py-2 pl-9 pr-3 text-sm text-[#073c44] outline-none transition focus:border-[#0d5962]" /></label>
            <button type="button" onClick={shareLocation} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#0d5962]/24 bg-[#e8f4ef] px-4 text-sm font-bold text-[#0d5962] transition hover:bg-[#d9ece3]"><LocateFixed aria-hidden className="h-4 w-4" /> Near me</button>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKind)} className="min-h-11 border border-[#0d5962]/20 bg-white px-3 text-sm font-semibold text-[#073c44] outline-none focus:border-[#0d5962]"><option value="recommended">Recommended</option><option value="rating">Highest rated</option><option value="nearest">Nearest</option><option value="reviews">Most reviewed</option><option value="newest">Newest</option></select>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <FilterChip active={category === "all"} onClick={() => setCategory("all")}>All</FilterChip>
            {jejuPlaceCategories.map((item) => <FilterChip key={item} active={category === item} onClick={() => setCategory(item)}>{jejuCategoryLabels[item]}</FilterChip>)}
          </div>
          <div className="mt-3 grid gap-3 border-t border-[#0d5962]/10 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-xs font-bold uppercase text-[#567578]">Minimum rating<select value={minimumRating} onChange={(event) => setMinimumRating(Number(event.target.value) as 0 | 3 | 4 | 4.5)} className="mt-1.5 min-h-10 w-full border border-[#0d5962]/20 bg-white px-3 text-sm font-semibold normal-case text-[#073c44] outline-none focus:border-[#0d5962]"><option value={0}>Any rating</option><option value={3}>3.0 and up</option><option value={4}>4.0 and up</option><option value={4.5}>4.5 and up</option></select></label>
            <label className="block text-xs font-bold uppercase text-[#567578]">Price<select value={priceRange} onChange={(event) => setPriceRange(event.target.value as "all" | "budget" | "moderate" | "premium")} className="mt-1.5 min-h-10 w-full border border-[#0d5962]/20 bg-white px-3 text-sm font-semibold normal-case text-[#073c44] outline-none focus:border-[#0d5962]"><option value="all">Any price</option><option value="budget">Budget</option><option value="moderate">Moderate</option><option value="premium">Premium</option></select></label>
            <div className="flex flex-wrap content-end gap-x-5 gap-y-2 pb-1 text-sm text-[#315b5f]"><Toggle label="Vegetarian" checked={vegetarianOnly} onChange={setVegetarianOnly} /><Toggle label="Vegan" checked={veganOnly} onChange={setVeganOnly} /><Toggle label="Spicy" checked={spicyOnly} onChange={setSpicyOnly} /><Toggle label="Seafood" checked={seafoodOnly} onChange={setSeafoodOnly} /><Toggle label="English friendly" checked={englishOnly} onChange={setEnglishOnly} /></div>
          </div>
          {locationMessage ? <p className="mt-3 text-xs leading-5 text-[#4c6769]">{locationMessage}</p> : null}
        </section>

        {error ? <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
        <p className="text-sm text-[#4c6769]">{filteredPlaces.length} confirmed places</p>
        {filteredPlaces.length > 0 ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filteredPlaces.map((place) => <PlaceCard key={place.id} place={place} distance={position ? Math.round(getDistanceInMeters(position, place)) : null} />)}</div> : <div className="border border-dashed border-[#0d5962]/22 bg-white/55 px-5 py-12 text-center text-sm leading-6 text-[#4c6769]">No confirmed places match these filters yet.</div>}
      </div>
    </JejuShell>
  );
}

function PlaceCard({ place, distance }: { place: JejuPlace; distance: number | null }) {
  return <Link href={`/jeju/place/${place.id}`} className="group overflow-hidden border border-[#0d5962]/12 bg-white/82 transition hover:-translate-y-0.5 hover:border-[#0d5962]/40 hover:shadow-[0_14px_30px_rgba(13,89,98,0.10)]">{place.thumbnailUrl ? <img src={place.thumbnailUrl} alt="" className="aspect-[16/9] w-full object-cover" /> : <div className="grid aspect-[16/9] place-items-center bg-[#dcefe8] text-xs font-bold text-[#0d5962]">JEJU EXPLORER</div>}<div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-xs font-bold uppercase text-[#0d5962]">{jejuCategoryLabels[place.category]}</span><h2 className="mt-1 truncate font-serif text-xl font-semibold text-[#073c44]">{placeTitle(place)}</h2></div>{place.reviewCount > 0 ? <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-[#a66e1d]"><Star aria-hidden className="h-4 w-4 fill-current" />{place.averageRating.toFixed(1)}</span> : null}</div><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#4c6769]">{place.descriptionEn || place.description || place.address}</p><div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold text-[#315b5f]">{place.vegetarianSupported ? <span className="bg-[#e5f1d8] px-2 py-1">Vegetarian</span> : null}{place.veganSupported ? <span className="bg-[#e5f1d8] px-2 py-1">Vegan</span> : null}{place.englishFriendly ? <span className="bg-[#dceeea] px-2 py-1">English</span> : null}{distance !== null ? <span className="bg-[#f6ebd1] px-2 py-1">{distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`}</span> : null}</div></div></Link>;
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition ${active ? "border-[#0d5962] bg-[#0d5962] text-white" : "border-[#0d5962]/18 bg-white text-[#315b5f] hover:bg-[#e8f4ef]"}`}>{children}</button>;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#0d5962]" />{label}</label>;
}
