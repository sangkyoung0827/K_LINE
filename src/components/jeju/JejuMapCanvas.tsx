"use client";

import { Check, MapPin } from "lucide-react";
import Link from "next/link";
import type { JejuPlace } from "@/lib/jeju/types";
import { jejuCategoryLabels, placeTitle } from "@/components/jeju/jeju-client";

function markerPosition(place: JejuPlace) {
  const left = Math.max(8, Math.min(91, 10 + ((place.longitude - 126.1) / 0.9) * 76));
  const top = Math.max(9, Math.min(88, 80 - ((place.latitude - 33.1) / 0.75) * 61));
  return { left: `${left}%`, top: `${top}%` };
}

export function JejuMapCanvas({
  places,
  visitedPlaceIds = [],
  compact = false
}: {
  places: JejuPlace[];
  visitedPlaceIds?: string[];
  compact?: boolean;
}) {
  const visited = new Set(visitedPlaceIds);

  return (
    <div className={`relative overflow-hidden border border-[#0d5962]/15 bg-[#b8e5e4] ${compact ? "min-h-[260px] rounded-2xl" : "min-h-[420px] rounded-3xl"}`}>
      <svg viewBox="0 0 1000 620" className="absolute inset-0 h-full w-full" role="img" aria-label="Interactive Jeju Island place map">
        <defs>
          <pattern id="jeju-grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1000" height="620" fill="url(#jeju-grid)" />
        <path
          d="M154 315 C178 235 280 180 386 169 C485 126 603 153 701 206 C794 224 859 291 847 356 C831 420 721 447 648 469 C562 505 444 511 337 482 C241 487 135 426 154 315 Z"
          fill="#dff0c4"
          stroke="#0d5962"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path d="M290 283 C379 240 479 237 565 271" fill="none" stroke="#a4c98c" strokeDasharray="12 14" strokeWidth="5" />
        <path d="M415 395 C512 341 652 336 744 359" fill="none" stroke="#a4c98c" strokeDasharray="12 14" strokeWidth="5" />
        <circle cx="506" cy="182" r="28" fill="#84ab6e" opacity=".86" />
        <text x="506" y="189" textAnchor="middle" fill="white" fontSize="22" fontWeight="700">Halla</text>
      </svg>

      {places.map((place) => {
        const hasVisited = visited.has(place.id);
        return (
          <Link
            key={place.id}
            href={`/jeju/place/${place.id}`}
            style={markerPosition(place)}
            title={placeTitle(place)}
            className={`group absolute z-10 -translate-x-1/2 -translate-y-1/2 ${compact ? "h-8 w-8" : "h-10 w-10"}`}
          >
            <span className={`flex h-full w-full items-center justify-center rounded-full border-2 border-white shadow-lg transition group-hover:scale-110 ${hasVisited ? "bg-[#d49b42] text-[#173b3f]" : "bg-[#0d5962] text-white"}`}>
              {hasVisited ? <Check aria-hidden className="h-4 w-4" /> : <MapPin aria-hidden className="h-4 w-4" />}
            </span>
            {!compact ? (
              <span className="pointer-events-none absolute left-1/2 top-full mt-1 hidden min-w-28 -translate-x-1/2 rounded-lg bg-[#073c44]/94 px-2 py-1.5 text-center text-[11px] font-semibold leading-4 text-white shadow-lg group-hover:block">
                {placeTitle(place)}
              </span>
            ) : null}
          </Link>
        );
      })}

      <div className="absolute bottom-3 left-3 rounded-xl border border-white/50 bg-white/88 px-3 py-2 text-xs font-semibold text-[#0c4f58] shadow-sm">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#0d5962]" /> On your map</span>
        <span className="ml-3 inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#d49b42]" /> Explored</span>
      </div>

      {places.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div className="max-w-sm rounded-2xl border border-white/70 bg-white/88 px-5 py-4 shadow-sm">
            <p className="font-serif text-xl font-semibold text-[#073c44]">Your Jeju map is ready.</p>
            <p className="mt-1.5 text-sm leading-6 text-[#315b5f]">Confirmed places will appear here as the Jeju Explorer map grows.</p>
          </div>
        </div>
      ) : null}

      {!compact && places.length > 0 ? (
        <div className="absolute right-3 top-3 hidden max-w-[11rem] rounded-xl bg-white/85 px-3 py-2 text-xs text-[#315b5f] shadow-sm sm:block">
          {Object.entries(jejuCategoryLabels).slice(0, 4).map(([key, label]) => (
            <span key={key} className="mr-2 inline-block py-0.5">{label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
