"use client";

import { Camera, Check, LocateFixed, MapPinned, Route, Square, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { JejuGoogleMap } from "@/components/jeju/JejuGoogleMap";
import { jejuCategoryLabels, placeTitle, readJejuResponse } from "@/components/jeju/jeju-client";
import type {
  JejuExploreSession,
  JejuExploreTrackPoint,
  JejuExploreTracking,
  JejuExplorerOverview,
  JejuPersonalPlaceRecord,
  JejuPlace,
  JejuPlaceCategory
} from "@/lib/jeju/types";

type OverviewResponse = JejuExplorerOverview & { user: { image: string; name: string } };
type TrackResponse = JejuExploreTracking;
type PersonalPlacesResponse = { records: JejuPersonalPlaceRecord[] };
type Position = { accuracyMeters: number | null; latitude: number; longitude: number };
type UploadedPhoto = { publicUrl: string; storagePath: string };
type GoogleMapPoi = {
  category: JejuPlaceCategory;
  formattedAddress: string;
  googlePlaceId: string;
  latitude: number;
  longitude: number;
  placeName: string;
};

const koreaCenter = { lat: 36.35, lng: 127.9 };
const browserMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
let mapsScriptPromise: Promise<any> | null = null;

function loadGoogleMaps(key: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps can load only in a browser."));
  const mapsWindow = window as typeof window & { google?: { maps?: any } };
  if (mapsWindow.google?.maps) return Promise.resolve(mapsWindow.google.maps);
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly`;
    script.onload = () => {
      const loadedMaps = (window as typeof window & { google?: { maps?: any } }).google?.maps;
      if (loadedMaps) resolve(loadedMaps);
      else reject(new Error("Google Maps did not finish loading."));
    };
    script.onerror = () => reject(new Error("Google Maps could not load. Check the browser key restrictions."));
    document.head.appendChild(script);
  });
  return mapsScriptPromise;
}

function categoryFromGoogleTypes(rawTypes: unknown): JejuPlaceCategory {
  const types = Array.isArray(rawTypes) ? rawTypes.filter((item): item is string => typeof item === "string") : [];
  if (types.includes("restaurant") || types.includes("food")) return "restaurant";
  if (types.includes("cafe") || types.includes("bakery")) return "cafe";
  if (types.includes("tourist_attraction") || types.includes("amusement_park") || types.includes("aquarium")) return "attraction";
  if (types.includes("museum") || types.includes("art_gallery") || types.includes("library")) return "culture";
  if (types.includes("park") || types.includes("natural_feature")) return "nature";
  if (types.includes("store") || types.includes("shopping_mall")) return "shopping";
  return "other";
}

function positionFromGeolocation(position: GeolocationPosition): Position {
  return {
    accuracyMeters: Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  };
}

function requestCurrentPosition() {
  return new Promise<Position>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser cannot share your location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(positionFromGeolocation(position)),
      () => reject(new Error("Location was not shared. You can still use the map.")),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 }
    );
  });
}

async function uploadPersonalPhoto(source: File): Promise<UploadedPhoto> {
  const file = await compressImage(source);
  const body = new FormData();
  body.set("file", file);
  body.set("scope", "personal-places");
  const response = await fetch("/api/jeju/uploads", { body, method: "POST" });
  const payload = (await response.json().catch(() => ({}))) as UploadedPhoto & { error?: string };
  if (!response.ok || !payload.publicUrl || !payload.storagePath) throw new Error(payload.error || "A photo could not upload.");
  return { publicUrl: payload.publicUrl, storagePath: payload.storagePath };
}

async function uploadReviewPhoto(source: File): Promise<UploadedPhoto> {
  const file = await compressImage(source);
  const body = new FormData();
  body.set("file", file);
  body.set("scope", "reviews");
  const response = await fetch("/api/jeju/uploads", { body, method: "POST" });
  const payload = (await response.json().catch(() => ({}))) as UploadedPhoto & { error?: string };
  if (!response.ok || !payload.publicUrl || !payload.storagePath) throw new Error(payload.error || "A photo could not upload.");
  return { publicUrl: payload.publicUrl, storagePath: payload.storagePath };
}

async function compressImage(file: File) {
  if (file.type === "image/gif" || file.size <= 1_200_000 || typeof window === "undefined") return file;
  try {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The image could not load."));
      image.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "jeju-photo"}.webp`, { type: "image/webp" }) : file;
  } catch {
    return file;
  }
}

export function JejuExploreMap() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapsRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const lineRefs = useRef<any[]>([]);
  const liveMarkerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [tracking, setTracking] = useState<TrackResponse | null>(null);
  const [personalRecords, setPersonalRecords] = useState<JejuPersonalPlaceRecord[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<GoogleMapPoi | null>(null);
  const [livePosition, setLivePosition] = useState<Position | null>(null);
  const [mapMessage, setMapMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);

  const loadRecords = useCallback(async () => {
    const [nextOverview, nextTracking, personal] = await Promise.all([
      readJejuResponse<OverviewResponse>("/api/jeju/overview"),
      readJejuResponse<TrackResponse>("/api/jeju/explore/track"),
      readJejuResponse<PersonalPlacesResponse>("/api/jeju/personal-places")
    ]);
    setOverview(nextOverview);
    setTracking(nextTracking);
    setPersonalRecords(personal.records);
    activeSessionRef.current = nextTracking.activeSession?.id ?? null;
  }, []);

  useEffect(() => {
    loadRecords().catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : "Your journey records could not load.");
    });
  }, [loadRecords]);

  useEffect(() => {
    if (!browserMapsKey || !mapElementRef.current) return;
    let cancelled = false;
    loadGoogleMaps(browserMapsKey)
      .then((maps) => {
        if (cancelled || !mapElementRef.current) return;
        mapsRef.current = maps;
        const map = new maps.Map(mapElementRef.current, {
          center: koreaCenter,
          clickableIcons: true,
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          zoom: 7
        });
        map.addListener("click", (event: any) => {
          if (!event?.placeId || !maps.places?.PlacesService) {
            setMapMessage("Tap a named place on the Google map or a K_LINE marker to add a record.");
            return;
          }
          event.stop?.();
          const placesService = new maps.places.PlacesService(map);
          placesService.getDetails(
            {
              fields: ["formatted_address", "geometry", "name", "place_id", "types"],
              placeId: event.placeId
            },
            (result: any, status: unknown) => {
              const location = result?.geometry?.location;
              if (status !== maps.places.PlacesServiceStatus?.OK || !result?.name || !location) {
                setMapMessage("This Google map place could not be opened. Try another named place.");
                return;
              }
              setSelectedPlaceId(null);
              setSelectedPoi({
                category: categoryFromGoogleTypes(result.types),
                formattedAddress: result.formatted_address ?? "",
                googlePlaceId: result.place_id ?? event.placeId,
                latitude: typeof location.lat === "function" ? location.lat() : location.lat,
                longitude: typeof location.lng === "function" ? location.lng() : location.lng,
                placeName: result.name
              });
              setMapMessage("");
            }
          );
        });
        mapRef.current = map;
        setMapsReady(true);
      })
      .catch((error: unknown) => setMapMessage(error instanceof Error ? error.message : "Google Maps could not load."));

    return () => {
      cancelled = true;
      mapRef.current = null;
      setMapsReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapsRef.current || !overview || !mapsReady) return;
    const maps = mapsRef.current;
    markerRefs.current.forEach((marker) => marker.setMap?.(null));
    lineRefs.current.forEach((line) => line.setMap?.(null));
    markerRefs.current = [];
    lineRefs.current = [];
    const visitedPlaceIds = new Set(overview.visits.map((visit) => visit.placeId));

    overview.places.forEach((place) => {
      const marker = new maps.Marker({
        map: mapRef.current,
        position: { lat: place.latitude, lng: place.longitude },
        title: placeTitle(place)
      });
      marker.addListener("click", () => {
        setSelectedPoi(null);
        setSelectedPlaceId(place.id);
        setMapMessage(visitedPlaceIds.has(place.id) ? "This place is already in your journey record." : "Check in here, then add your rating and photos.");
      });
      markerRefs.current.push(marker);
    });

    personalRecords.forEach((record) => {
      const marker = new maps.Marker({
        label: "★",
        map: mapRef.current,
        position: { lat: record.latitude, lng: record.longitude },
        title: `${record.placeName} · ${record.rating}/5`
      });
      marker.addListener("click", () => {
        setSelectedPlaceId(null);
        setSelectedPoi({
          category: record.category,
          formattedAddress: record.formattedAddress,
          googlePlaceId: record.googlePlaceId,
          latitude: record.latitude,
          longitude: record.longitude,
          placeName: record.placeName
        });
        setMapMessage("Your saved personal journey record is open below.");
      });
      markerRefs.current.push(marker);
    });

    const pointsBySession = new Map<string, JejuExploreTrackPoint[]>();
    tracking?.points.forEach((point) => {
      const points = pointsBySession.get(point.sessionId) ?? [];
      points.push(point);
      pointsBySession.set(point.sessionId, points);
    });
    pointsBySession.forEach((points) => {
      if (points.length < 2) return;
      const line = new maps.Polyline({
        geodesic: true,
        map: mapRef.current,
        path: points.map((point) => ({ lat: point.latitude, lng: point.longitude })),
        strokeColor: "#0d5962",
        strokeOpacity: 0.76,
        strokeWeight: 4
      });
      lineRefs.current.push(line);
    });
  }, [mapsReady, overview, personalRecords, tracking]);

  useEffect(() => {
    if (!mapRef.current || !mapsRef.current || !livePosition) return;
    const maps = mapsRef.current;
    if (!liveMarkerRef.current) {
      liveMarkerRef.current = new maps.Marker({
        map: mapRef.current,
        position: { lat: livePosition.latitude, lng: livePosition.longitude },
        title: "Your current location"
      });
    } else {
      liveMarkerRef.current.setPosition({ lat: livePosition.latitude, lng: livePosition.longitude });
    }
    mapRef.current.panTo({ lat: livePosition.latitude, lng: livePosition.longitude });
  }, [livePosition]);

  useEffect(() => {
    const stopWatch = () => {
      if (watchIdRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
    return stopWatch;
  }, []);

  const activeSession = tracking?.activeSession ?? null;
  const selectedPlace = useMemo(() => overview?.places.find((place) => place.id === selectedPlaceId) ?? null, [overview, selectedPlaceId]);
  const selectedPersonalRecord = useMemo(() => selectedPoi ? personalRecords.find((record) => record.googlePlaceId === selectedPoi.googlePlaceId) ?? null : null, [personalRecords, selectedPoi]);

  function startWatch(session: JejuExploreSession) {
    if (!navigator.geolocation) return;
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextPosition = positionFromGeolocation(position);
        setLivePosition(nextPosition);
        readJejuResponse<{ recorded: boolean }>("/api/jeju/explore/track", {
          body: JSON.stringify({
            accuracyMeters: nextPosition.accuracyMeters,
            action: "point",
            latitude: nextPosition.latitude,
            longitude: nextPosition.longitude,
            sessionId: session.id
          }),
          method: "POST"
        }).then((result) => {
          if (result.recorded) loadRecords().catch(() => undefined);
        }).catch((error: unknown) => {
          setMapMessage(error instanceof Error ? error.message : "A location point could not be saved.");
        });
      },
      () => setMapMessage("Location updates stopped. You can keep browsing the map or start a new record."),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 25_000 }
    );
  }

  async function startTracking() {
    setTrackingBusy(true);
    setMapMessage("Requesting your location to begin this private exploration record…");
    try {
      const position = await requestCurrentPosition();
      const result = await readJejuResponse<{ point: JejuExploreTrackPoint | null; session: JejuExploreSession }>("/api/jeju/explore/track", {
        body: JSON.stringify({
          accuracyMeters: position.accuracyMeters,
          action: "start",
          latitude: position.latitude,
          longitude: position.longitude
        }),
        method: "POST"
      });
      activeSessionRef.current = result.session.id;
      setLivePosition(position);
      setMapMessage("Exploration recording is on. K_LINE saves a reduced route only while this Memory Book page is open.");
      await loadRecords();
      startWatch(result.session);
    } catch (error) {
      setMapMessage(error instanceof Error ? error.message : "Exploration recording could not start.");
    } finally {
      setTrackingBusy(false);
    }
  }

  async function stopTracking() {
    const sessionId = activeSessionRef.current;
    if (!sessionId) return;
    setTrackingBusy(true);
    if (watchIdRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    try {
      await readJejuResponse<{ session: JejuExploreSession }>("/api/jeju/explore/track", {
        body: JSON.stringify({ action: "stop", sessionId }),
        method: "POST"
      });
      activeSessionRef.current = null;
      setMapMessage("Exploration recording is stopped. Your saved route remains private for a future memory book.");
      await loadRecords();
    } catch (error) {
      setMapMessage(error instanceof Error ? error.message : "Exploration recording could not stop.");
    } finally {
      setTrackingBusy(false);
    }
  }

  return (
    <section className="overflow-hidden border border-[#0d5962]/14 bg-white/82">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#0d5962]/12 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-[#073c44]"><MapPinned aria-hidden className="h-4 w-4 text-[#0d5962]" />Live Korea map</p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#4c6769]">Start an exploration only when you want to save this trip. It runs only on this page, stores a reduced private route, and can be stopped at any time.</p>
        </div>
        <button
          type="button"
          disabled={trackingBusy}
          onClick={activeSession ? stopTracking : startTracking}
          className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 px-4 text-xs font-bold transition disabled:cursor-wait disabled:opacity-60 ${activeSession ? "bg-[#173b3f] text-white hover:bg-[#0b2d31]" : "bg-[#0d5962] text-white hover:bg-[#073c44]"}`}
        >
          {activeSession ? <Square aria-hidden className="h-3.5 w-3.5 fill-current" /> : <Route aria-hidden className="h-4 w-4" />}
          {trackingBusy ? "Updating…" : activeSession ? "Stop exploration" : "Start exploration"}
        </button>
      </div>

      {browserMapsKey ? <div ref={mapElementRef} className="h-[min(62svh,38rem)] min-h-[22rem] w-full" aria-label="Interactive Google Map of South Korea" /> : <JejuGoogleMap />}

      <div className="border-t border-[#0d5962]/12 px-4 py-3 sm:px-5">
        {browserMapsKey ? <p className="text-xs leading-5 text-[#4c6769]">Click a named Google map place anywhere in South Korea to save your own rating and optional photos. Click a K_LINE marker to check in, then leave a verified review.</p> : <p className="text-xs leading-5 text-[#4c6769]">Interactive place recording will activate after the restricted Google Maps browser key is added. The nationwide live map remains available now.</p>}
        {mapMessage ? <p aria-live="polite" className="mt-2 text-xs leading-5 text-[#315b5f]">{mapMessage}</p> : null}
        {loadError ? <p role="alert" className="mt-2 text-xs leading-5 text-red-700">{loadError}</p> : null}
      </div>

      {selectedPlace && overview ? <VerifiedPlacePanel place={selectedPlace} visited={overview.visits.some((visit) => visit.placeId === selectedPlace.id)} livePosition={livePosition} onClose={() => setSelectedPlaceId(null)} onCheckedIn={(visit) => setOverview((current) => current ? { ...current, visits: [visit, ...current.visits] } : current)} /> : null}
      {selectedPoi ? <PersonalPlacePanel poi={selectedPoi} record={selectedPersonalRecord} onClose={() => setSelectedPoi(null)} onSaved={(record) => {
        setPersonalRecords((records) => [record, ...records.filter((item) => item.id !== record.id)]);
        setMapMessage("Your personal journey record has been saved for a future memory book.");
      }} /> : null}
    </section>
  );
}

function VerifiedPlacePanel({ place, visited, livePosition, onCheckedIn, onClose }: {
  place: JejuPlace;
  visited: boolean;
  livePosition: Position | null;
  onCheckedIn: (visit: JejuExplorerOverview["visits"][number]) => void;
  onClose: () => void;
}) {
  const [checkingIn, setCheckingIn] = useState(false);
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function checkIn() {
    setCheckingIn(true);
    setMessage("Confirming your location…");
    try {
      const position = livePosition ?? await requestCurrentPosition();
      const result = await readJejuResponse<{ distanceMeters: number; success: boolean; visit: JejuExplorerOverview["visits"][number] | null }>("/api/jeju/visits", {
        body: JSON.stringify({ latitude: position.latitude, longitude: position.longitude, placeId: place.id }),
        method: "POST"
      });
      if (!result.success || !result.visit) {
        setMessage(`You need to be closer to this place to check in. Current distance: ${result.distanceMeters} m.`);
        return;
      }
      onCheckedIn(result.visit);
      setMessage("Checked in. You can now save your rating and photos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This check-in could not be saved.");
    } finally {
      setCheckingIn(false);
    }
  }

  async function saveReview() {
    setSaving(true);
    setMessage("Saving your rating…");
    try {
      const uploaded = await Promise.all(photos.slice(0, 5).map(uploadReviewPhoto));
      await readJejuResponse("/api/jeju/reviews", {
        body: JSON.stringify({
          atmosphereRating: rating,
          foodRating: place.category === "restaurant" || place.category === "cafe" ? rating : null,
          overallRating: rating,
          photos: uploaded,
          placeId: place.id,
          priceRating: rating,
          reviewText: note,
          wouldRecommend: true
        }),
        method: "POST"
      });
      setPhotos([]);
      setMessage("Your K_LINE place rating has been saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your rating could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="border-t border-[#0d5962]/14 bg-[#f8fcfa] p-4 sm:p-5"><PanelHeader eyebrow={jejuCategoryLabels[place.category]} title={placeTitle(place)} onClose={onClose} /><p className="mt-2 text-sm leading-6 text-[#4c6769]">{place.address || "K_LINE verified map place"}</p>{!visited ? <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={checkIn} disabled={checkingIn} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#0d5962] px-4 text-sm font-bold text-white transition hover:bg-[#073c44] disabled:opacity-60"><LocateFixed aria-hidden className="h-4 w-4" />{checkingIn ? "Checking in…" : "Check in to record this visit"}</button><p className="text-xs leading-5 text-[#4c6769]">You must be within 150 m. Your precise location is not saved for this check-in.</p></div> : <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]"><div><p className="text-sm font-semibold text-[#234e53]">Rate this visit</p><StarRating value={rating} onChange={setRating} /><label className="mt-3 block"><span className="sr-only">Optional note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="A short note for your future memory book" className="w-full border border-[#0d5962]/20 bg-white px-3 py-2 text-sm leading-6 text-[#073c44] outline-none focus:border-[#0d5962]" /></label><PhotoPicker files={photos} setFiles={setPhotos} /></div><button type="button" onClick={saveReview} disabled={saving} className="inline-flex min-h-11 h-fit items-center justify-center gap-2 bg-[#f0c56b] px-4 text-sm font-bold text-[#173b3f] transition hover:bg-[#e3b252] disabled:opacity-60"><Star aria-hidden className="h-4 w-4" />{saving ? "Saving…" : "Save rating"}</button></div>}{message ? <p aria-live="polite" className="mt-3 text-xs leading-5 text-[#315b5f]">{message}</p> : null}</div>;
}

function PersonalPlacePanel({ poi, record, onClose, onSaved }: { poi: GoogleMapPoi; record: JejuPersonalPlaceRecord | null; onClose: () => void; onSaved: (record: JejuPersonalPlaceRecord) => void }) {
  const [rating, setRating] = useState(record?.rating ?? 5);
  const [note, setNote] = useState(record?.note ?? "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setRating(record?.rating ?? 5);
    setNote(record?.note ?? "");
    setPhotos([]);
    setMessage("");
  }, [poi.googlePlaceId, record?.id, record?.note, record?.rating]);

  async function save() {
    setSaving(true);
    setMessage("Saving your personal place record…");
    try {
      const uploaded = await Promise.all(photos.slice(0, 5).map(uploadPersonalPhoto));
      const response = await readJejuResponse<{ record: JejuPersonalPlaceRecord }>("/api/jeju/personal-places", {
        body: JSON.stringify({ ...poi, note, photos: uploaded, rating }),
        method: "POST"
      });
      onSaved(response.record);
      setPhotos([]);
      setMessage("Saved privately in your journey record.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This place record could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="border-t border-[#0d5962]/14 bg-[#f8fcfa] p-4 sm:p-5"><PanelHeader eyebrow={`${jejuCategoryLabels[poi.category]} · Private journey record`} title={poi.placeName} onClose={onClose} /><p className="mt-2 text-sm leading-6 text-[#4c6769]">{poi.formattedAddress || "Google map place"}</p><div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]"><div><p className="text-sm font-semibold text-[#234e53]">Your rating</p><StarRating value={rating} onChange={setRating} /><label className="mt-3 block"><span className="sr-only">Personal note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="What would you like to remember about this place?" className="w-full border border-[#0d5962]/20 bg-white px-3 py-2 text-sm leading-6 text-[#073c44] outline-none focus:border-[#0d5962]" /></label><PhotoPicker files={photos} setFiles={setPhotos} />{record?.photos.length ? <div className="mt-3 flex flex-wrap gap-2">{record.photos.map((photo) => <img key={photo.id} src={photo.publicUrl} alt="Your journey memory" className="h-14 w-14 object-cover" />)}</div> : null}</div><button type="button" onClick={save} disabled={saving} className="inline-flex min-h-11 h-fit items-center justify-center gap-2 bg-[#f0c56b] px-4 text-sm font-bold text-[#173b3f] transition hover:bg-[#e3b252] disabled:opacity-60"><Check aria-hidden className="h-4 w-4" />{saving ? "Saving…" : record ? "Update record" : "Save to journey"}</button></div>{message ? <p aria-live="polite" className="mt-3 text-xs leading-5 text-[#315b5f]">{message}</p> : null}</div>;
}

function PanelHeader({ eyebrow, onClose, title }: { eyebrow: string; onClose: () => void; title: string }) {
  return <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-bold uppercase text-[#0d5962]">{eyebrow}</p><h2 className="mt-1 truncate font-serif text-2xl font-semibold text-[#073c44]">{title}</h2></div><button type="button" onClick={onClose} aria-label="Close place record" className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[#0d5962]/20 bg-white text-[#315b5f] transition hover:bg-[#e8f4ef]"><X aria-hidden className="h-4 w-4" /></button></div>;
}

function StarRating({ onChange, value }: { onChange: (value: number) => void; value: number }) {
  return <div className="mt-2 flex gap-1" aria-label={`${value} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-label={`${star} stars`} aria-pressed={value === star} onClick={() => onChange(star)} className={`p-1 transition ${star <= value ? "text-[#d49b42]" : "text-[#9cb7b6]"}`}><Star aria-hidden className={`h-6 w-6 ${star <= value ? "fill-current" : ""}`} /></button>)}</div>;
}

function PhotoPicker({ files, setFiles }: { files: File[]; setFiles: (files: File[]) => void }) {
  function change(event: ChangeEvent<HTMLInputElement>) {
    setFiles([...files, ...Array.from(event.target.files ?? [])].slice(0, 5));
    event.target.value = "";
  }
  return <div className="mt-3"><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-dashed border-[#0d5962]/34 bg-[#eaf4ef] px-3 text-sm font-bold text-[#0d5962]"><Camera aria-hidden className="h-4 w-4" />Add photos<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={change} /></label>{files.length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{files.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-1.5 bg-[#edf6f2] px-2 py-1 text-xs text-[#315b5f]"><span className="max-w-40 truncate">{file.name}</span><button type="button" onClick={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}><X aria-hidden className="h-3.5 w-3.5" /></button></span>)}</div> : null}</div>;
}
