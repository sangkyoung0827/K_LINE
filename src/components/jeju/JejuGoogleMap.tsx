"use client";

import { ExternalLink, LocateFixed, MapPinned } from "lucide-react";
import { useState } from "react";

const koreaMapQuery = "South Korea";

function buildGoogleMapsUrl(query: string, zoom = 7) {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;
}

export function JejuGoogleMap() {
  const [mapUrl, setMapUrl] = useState(() => buildGoogleMapsUrl(koreaMapQuery));
  const [status, setStatus] = useState("Live Google Map of South Korea");
  const [locating, setLocating] = useState(false);

  function showCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("This browser cannot share your location. You can still explore the live Korea map.");
      return;
    }

    setLocating(true);
    setStatus("Requesting your location only to center this map…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const query = `${position.coords.latitude},${position.coords.longitude}`;
        setMapUrl(buildGoogleMapsUrl(query, 14));
        setStatus("Your one-time location is shown on the map. It was not saved by K_LINE.");
        setLocating(false);
      },
      () => {
        setStatus("Location was not shared. The map remains centered on South Korea.");
        setLocating(false);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }
    );
  }

  return (
    <section className="overflow-hidden border border-[#0d5962]/14 bg-white/82">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0d5962]/12 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-[#073c44]">
            <MapPinned aria-hidden className="h-4 w-4 text-[#0d5962]" />
            Live Google Map
          </p>
          <p aria-live="polite" className="mt-1 text-xs leading-5 text-[#4c6769]">{status}</p>
        </div>
        <button
          type="button"
          onClick={showCurrentLocation}
          disabled={locating}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-[#0d5962]/22 bg-[#e8f4ef] px-3 text-xs font-bold text-[#0d5962] transition hover:bg-[#d9ece3] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          <LocateFixed aria-hidden className="h-4 w-4" />
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>

      <iframe
        key={mapUrl}
        title="Live Google Map of South Korea"
        src={mapUrl}
        className="block h-[52dvh] min-h-[20rem] w-full border-0 sm:h-[min(62svh,38rem)] sm:min-h-[22rem]"
        loading="eager"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />

      <div className="flex flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <p className="text-xs leading-5 text-[#4c6769]">Map data is provided live by Google Maps. K_LINE never tracks your location in the background.</p>
        <a
          href="https://www.google.com/maps/search/?api=1&query=South%20Korea"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#0d5962]/14 bg-[#f3faf7] px-3 text-xs font-bold text-[#0d5962] hover:bg-[#e8f4ef] hover:text-[#073c44] sm:min-h-0 sm:w-auto sm:border-0 sm:bg-transparent sm:px-0"
        >
          Open Google Maps <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </a>
      </div>
    </section>
  );
}
