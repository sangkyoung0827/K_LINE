"use client";

import { BookOpen, ChevronLeft, ChevronRight, MapPin, Route, Save, Sparkles, Square, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";
import { readJejuResponse } from "@/components/jeju/jeju-client";
import type { JejuExploreSession, JejuExploreTrackPoint, JejuExploreTracking, JejuPersonalPlaceRecord, JejuProfile } from "@/lib/jeju/types";

type ActivityRecord = {
  activityDate: string;
  activityId: string;
  activityInstanceId: string;
  activityTitle: string;
  createdAt: string;
  dismissedAt: string | null;
  eligibleAt: string;
  id: string;
  ratedAt: string | null;
  rating: number | null;
  source: "ecc" | "hanhwal";
};

type ProfileResponse = {
  profile: JejuProfile | null;
  user: { email: string; name: string };
};

type OverviewResponse = {
  user: { image: string; name: string };
};

type PersonalPlacesResponse = { records: JejuPersonalPlaceRecord[] };
type ActivityRecordsResponse = { records: ActivityRecord[] };
type Position = { accuracyMeters: number | null; latitude: number; longitude: number };
type StreamEvent = { type?: string; text?: string; error?: string };

type MemoryProfile = {
  name: string;
  nationality: string;
  university: string;
  major: string;
  languages: string;
  purpose: string;
  interests: string;
  intro: string;
};

type MemoryEntry = {
  id: string;
  kind: "activity" | "place" | "route";
  title: string;
  subtitle: string;
  rating: number | null;
  photos: string[];
};

type MemoryPage = {
  date: string;
  entries: MemoryEntry[];
};

const emptyProfile: MemoryProfile = {
  name: "",
  nationality: "",
  university: "",
  major: "",
  languages: "",
  purpose: "",
  interests: "",
  intro: ""
};

function localDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function displayDate(value: string, korean: boolean) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(korean ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
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
      () => reject(new Error("Location permission is required to start exploration.")),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 }
    );
  });
}

function parseStoredProfile(raw: string | null) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<MemoryProfile>;
    return Object.fromEntries(Object.keys(emptyProfile).map((key) => [key, typeof value[key as keyof MemoryProfile] === "string" ? value[key as keyof MemoryProfile] : ""])) as MemoryProfile;
  } catch {
    return null;
  }
}

export function MemoryBookStudio() {
  const { language } = useLanguage();
  const korean = language === "ko";
  const watchIdRef = useRef<number | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const recommendationLoadedRef = useRef(false);

  const [profileResponse, setProfileResponse] = useState<ProfileResponse | null>(null);
  const [avatar, setAvatar] = useState("");
  const [profile, setProfile] = useState<MemoryProfile>(emptyProfile);
  const [personalPlaces, setPersonalPlaces] = useState<JejuPersonalPlaceRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [tracking, setTracking] = useState<JejuExploreTracking | null>(null);
  const [bookStarted, setBookStarted] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const loadData = useCallback(async () => {
    const [profileResult, placesResult, trackingResult, activitiesResult, overviewResult] = await Promise.all([
      readJejuResponse<ProfileResponse>("/api/jeju/profile"),
      readJejuResponse<PersonalPlacesResponse>("/api/jeju/personal-places"),
      readJejuResponse<JejuExploreTracking>("/api/jeju/explore/track"),
      fetch("/api/activity-history/records").then((response) => response.json() as Promise<ActivityRecordsResponse>),
      readJejuResponse<OverviewResponse>("/api/jeju/overview")
    ]);

    setProfileResponse(profileResult);
    setAvatar(overviewResult.user?.image ?? "");
    setPersonalPlaces(placesResult.records ?? []);
    setActivities(activitiesResult.records ?? []);
    setTracking(trackingResult);
    activeSessionRef.current = trackingResult.activeSession?.id ?? null;

    const storageKey = `kline-memory-book-profile:${profileResult.user.email}`;
    const stored = parseStoredProfile(window.localStorage.getItem(storageKey));
    const defaults: MemoryProfile = {
      name: profileResult.profile?.displayName || profileResult.user.name || "",
      nationality: "",
      university: "",
      major: "",
      languages: "",
      purpose: "",
      interests: profileResult.profile?.preferredActivities.join(", ") || profileResult.profile?.preferredFoods.join(", ") || "",
      intro: ""
    };
    setProfile(stored ? { ...defaults, ...stored } : defaults);

    const startedKey = `kline-memory-book-started:${profileResult.user.email}`;
    const explorationKey = `kline-exploration-enabled:${profileResult.user.email}`;
    const started = window.localStorage.getItem(startedKey) === "1";
    const explorationEnabled = window.localStorage.getItem(explorationKey) === "1";
    setBookStarted(started);

    if (explorationEnabled && trackingResult.activeSession) {
      startWatch(trackingResult.activeSession.id);
    }
  }, []);

  useEffect(() => {
    loadData().catch(() => setTrackingMessage(korean ? "개인 기록을 불러오지 못했습니다." : "Your private records could not load."));
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [korean, loadData]);

  function startWatch(sessionId: string) {
    if (!navigator.geolocation) return;
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextPosition = positionFromGeolocation(position);
        fetch("/api/jeju/explore/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accuracyMeters: nextPosition.accuracyMeters,
            action: "point",
            latitude: nextPosition.latitude,
            longitude: nextPosition.longitude,
            sessionId
          })
        }).catch(() => undefined);
      },
      () => setTrackingMessage(korean ? "위치 기록이 잠시 멈췄습니다. 지도와 기존 기록은 계속 사용할 수 있습니다." : "Location updates paused. Your map and saved records still work."),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 25_000 }
    );
  }

  async function beginExploration() {
    if (!profileResponse || trackingBusy) return;
    setTrackingBusy(true);
    setTrackingMessage(korean ? "위치 권한을 확인하고 탐험 기록을 시작합니다…" : "Checking location permission and starting your exploration…");
    try {
      const position = await requestCurrentPosition();
      let session: JejuExploreSession | null = tracking?.activeSession ?? null;

      if (!session) {
        const result = await readJejuResponse<{ session: JejuExploreSession }>("/api/jeju/explore/track", {
          method: "POST",
          body: JSON.stringify({
            accuracyMeters: position.accuracyMeters,
            action: "start",
            latitude: position.latitude,
            longitude: position.longitude
          })
        });
        session = result.session;
      }

      activeSessionRef.current = session.id;
      startWatch(session.id);
      window.localStorage.setItem(`kline-memory-book-started:${profileResponse.user.email}`, "1");
      window.localStorage.setItem(`kline-exploration-enabled:${profileResponse.user.email}`, "1");
      setBookStarted(true);
      setBookOpen(true);
      setConfirmOpen(false);
      setPageIndex(0);
      setTrackingMessage(korean ? "탐험 기록이 시작되었습니다. 웹에서는 이 페이지가 열려 있는 동안 위치가 기록됩니다." : "Exploration started. On the web, location is recorded while this page remains open.");
      await loadData();
    } catch (error) {
      setTrackingMessage(error instanceof Error ? error.message : korean ? "탐험을 시작하지 못했습니다." : "Exploration could not start.");
    } finally {
      setTrackingBusy(false);
    }
  }

  async function stopExploration() {
    if (!profileResponse || trackingBusy) return;
    const sessionId = activeSessionRef.current;
    setTrackingBusy(true);
    if (watchIdRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    try {
      if (sessionId) {
        await readJejuResponse("/api/jeju/explore/track", {
          method: "POST",
          body: JSON.stringify({ action: "stop", sessionId })
        });
      }
      activeSessionRef.current = null;
      window.localStorage.setItem(`kline-exploration-enabled:${profileResponse.user.email}`, "0");
      setTrackingMessage(korean ? "탐험을 종료했습니다. 지금까지의 장소·별점·사진·활동 기록은 그대로 보존됩니다." : "Exploration stopped. Your places, ratings, photos, and activity history remain saved.");
      await loadData();
    } catch (error) {
      setTrackingMessage(error instanceof Error ? error.message : korean ? "탐험을 종료하지 못했습니다." : "Exploration could not stop.");
    } finally {
      setTrackingBusy(false);
    }
  }

  function onBookClick() {
    if (bookStarted) {
      setBookOpen(true);
      setPageIndex(0);
      return;
    }
    setConfirmOpen(true);
  }

  function saveProfile() {
    if (!profileResponse) return;
    window.localStorage.setItem(`kline-memory-book-profile:${profileResponse.user.email}`, JSON.stringify(profile));
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 1800);
  }

  const memoryPages = useMemo<MemoryPage[]>(() => {
    const grouped = new Map<string, MemoryEntry[]>();
    const push = (date: string, entry: MemoryEntry) => {
      const items = grouped.get(date) ?? [];
      items.push(entry);
      grouped.set(date, items);
    };

    personalPlaces.forEach((place) => {
      push(localDateKey(place.updatedAt || place.createdAt), {
        id: `place-${place.id}`,
        kind: "place",
        title: place.placeName,
        subtitle: place.formattedAddress || (korean ? "내가 저장한 장소" : "Saved place"),
        rating: place.rating,
        photos: place.photos.map((photo) => photo.publicUrl)
      });
    });

    activities.forEach((activity) => {
      push(localDateKey(activity.activityDate || activity.createdAt), {
        id: `activity-${activity.id}`,
        kind: "activity",
        title: activity.activityTitle,
        subtitle: activity.source === "ecc" ? "ECC activity" : "Hanhwal activity",
        rating: activity.rating,
        photos: []
      });
    });

    const pointsByDay = new Map<string, JejuExploreTrackPoint[]>();
    tracking?.points.forEach((point) => {
      const date = localDateKey(point.recordedAt);
      const points = pointsByDay.get(date) ?? [];
      points.push(point);
      pointsByDay.set(date, points);
    });
    pointsByDay.forEach((points, date) => {
      push(date, {
        id: `route-${date}`,
        kind: "route",
        title: korean ? "한국 탐험 이동 기록" : "Korea exploration route",
        subtitle: korean ? `${points.length}개의 축약 위치 포인트가 기록됨` : `${points.length} reduced location points recorded`,
        rating: null,
        photos: []
      });
    });

    return Array.from(grouped.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([date, entries]) => ({ date, entries }));
  }, [activities, korean, personalPlaces, tracking?.points]);

  const totalBookPages = 1 + memoryPages.length + 1;
  const currentMemoryPage = pageIndex > 0 && pageIndex <= memoryPages.length ? memoryPages[pageIndex - 1] : null;
  const recommendationPage = pageIndex === totalBookPages - 1;

  const loadRecommendation = useCallback(async () => {
    if (recommendationLoadedRef.current || recommendationBusy || (!personalPlaces.length && !activities.length && !(tracking?.points.length))) return;
    recommendationLoadedRef.current = true;
    setRecommendationBusy(true);
    setRecommendation("");
    try {
      const lastPoint = tracking?.points.at(-1);
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: "jeju",
          currentLocation: lastPoint ? { latitude: lastPoint.latitude, longitude: lastPoint.longitude } : null,
          history: [],
          message: korean
            ? "내가 저장한 방문 장소와 별점, 활동 기록, 이동 기록을 바탕으로 다음에 할 만한 한국 경험 3가지만 추천해줘. 높은 별점을 준 경험과 비슷한 것을 가장 우선하고, 아직 안 가본 가까운 장소와 내 관심사를 다음으로 고려해줘. ECC나 한활 활동 이력은 취향 참고용으로만 사용하고, 내가 요청하지 않는 한 해당 동아리 재참여를 추천하지 마. 각 추천은 이유를 한 문장으로 설명해줘."
            : "Recommend exactly three next experiences in Korea from my saved places and ratings, activity history, and movement record. Prioritize experiences similar to things I rated highly, then nearby unvisited places and my interests. Use ECC or Hanhwal history only as a taste signal; do not recommend rejoining or future club participation unless I ask. Give one short reason for each recommendation.",
          modelVersion: "4"
        })
      });
      if (!response.ok || !response.body) throw new Error("Recommendation could not load.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "text" && event.text) {
            answer += event.text;
            setRecommendation(answer);
          }
          if (event.type === "error") throw new Error(event.error || "Recommendation could not load.");
        }
      }
    } catch (error) {
      recommendationLoadedRef.current = false;
      setRecommendation(error instanceof Error ? error.message : korean ? "추천을 불러오지 못했습니다." : "Recommendation could not load.");
    } finally {
      setRecommendationBusy(false);
    }
  }, [activities.length, korean, personalPlaces.length, recommendationBusy, tracking?.points]);

  useEffect(() => {
    if (bookOpen && recommendationPage) void loadRecommendation();
  }, [bookOpen, loadRecommendation, recommendationPage]);

  return (
    <section className="overflow-hidden border border-[#0d5962]/14 bg-[linear-gradient(135deg,#f9f5eb_0%,#edf7f3_52%,#f8fcfa_100%)] shadow-[0_24px_60px_rgba(13,89,98,0.08)]">
      <div className="grid gap-7 px-5 py-7 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] md:px-8 md:py-9">
        <div className="flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c68b35]">K_LINE Memory Book</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] text-[#073c44] sm:text-4xl">
            {korean ? "한국에서의 시간을 한 권에 모으세요" : "Build your own Korea Memory Book"}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#4c6769]">
            {korean
              ? "활동 기록, 지도 이동, 방문 장소, 별점과 직접 올린 사진은 추억록을 열지 않아도 사용자별로 계속 저장됩니다. 책은 그 기록을 읽어 실시간으로 페이지를 구성합니다."
              : "Your activity history, map movement, saved places, ratings, and your own photos are stored separately even before you open the book. The book reads those records and builds itself as your journey grows."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[#315b5f]">
            <span className="rounded-full bg-white/75 px-3 py-2">{personalPlaces.length} {korean ? "장소" : "places"}</span>
            <span className="rounded-full bg-white/75 px-3 py-2">{activities.length} {korean ? "활동" : "activities"}</span>
            <span className="rounded-full bg-white/75 px-3 py-2">{tracking?.points.length ?? 0} {korean ? "이동 포인트" : "route points"}</span>
          </div>
          {trackingMessage ? <p className="mt-4 text-xs leading-5 text-[#315b5f]">{trackingMessage}</p> : null}
          <p className="mt-3 text-[11px] leading-5 text-[#698287]">
            {korean ? "현재 웹 버전은 이 페이지가 열려 있을 때 위치를 기록합니다. 완전한 백그라운드 기록은 향후 K_LINE 앱에서 연결합니다." : "The web version records location while this page is open. Full background recording will be connected in the future K_LINE app."}
          </p>
        </div>

        <div className="grid place-items-center py-2 [perspective:1200px]">
          <button type="button" onClick={onBookClick} className="group relative block w-[min(78vw,24rem)] text-left focus:outline-none" aria-label={korean ? "추억록 열기" : "Open memory book"}>
            <div className="relative aspect-[4/5] origin-left transition duration-500 [transform:rotateY(-10deg)_rotateX(3deg)] group-hover:[transform:rotateY(-4deg)_rotateX(1deg)_translateY(-6px)]">
              <div className="absolute inset-y-2 -right-3 w-5 rounded-r-lg bg-[repeating-linear-gradient(90deg,#f8f2df_0,#f8f2df_2px,#e6dcc3_2px,#e6dcc3_3px)] shadow-lg" />
              <div className="absolute inset-0 overflow-hidden rounded-r-2xl border border-[#071f2c]/30 bg-[radial-gradient(circle_at_70%_20%,rgba(126,216,225,.24),transparent_35%),linear-gradient(145deg,#071f2c,#0d5962_62%,#123b4a)] shadow-[18px_24px_45px_rgba(7,31,44,.28)]">
                <div className="absolute inset-y-0 left-0 w-7 bg-black/20 shadow-[inset_-5px_0_9px_rgba(255,255,255,.08)]" />
                <div className="absolute left-10 right-7 top-9 border-t border-[#f0c56b]/55" />
                <div className="absolute bottom-9 left-10 right-7 border-t border-[#f0c56b]/35" />
                <div className="absolute inset-x-12 top-[20%] text-center text-[#f7e7b4]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em]">K_LINE</p>
                  <p className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{korean ? "한국 추억록" : "Korea Memory Book"}</p>
                  <p className="mt-2 text-xs text-white/60">Places · Activities · Memories</p>
                </div>
                <div className="absolute inset-x-0 top-[53%] flex justify-center">
                  <span className="relative flex h-24 w-40 items-center justify-center transition duration-300 group-hover:scale-105">
                    <span className="absolute inset-4 rounded-full bg-white/10 blur-xl" />
                    <WoohyukmonGlassesIcon className="relative h-20 w-36 drop-shadow-[0_14px_12px_rgba(0,0,0,.35)]" />
                  </span>
                </div>
                <div className="absolute bottom-14 inset-x-10 text-center text-[11px] font-semibold tracking-[0.12em] text-white/62">
                  {bookStarted ? (korean ? "CLICK TO CONTINUE" : "CLICK TO CONTINUE") : (korean ? "CLICK TO START" : "CLICK TO START")}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {tracking?.activeSession ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#0d5962]/12 bg-white/65 px-5 py-3 md:px-8">
          <span className="inline-flex items-center gap-2 text-xs font-bold text-[#0d5962]"><Route className="h-4 w-4" />{korean ? "탐험 기록 중" : "Exploration recording"}</span>
          <button type="button" onClick={() => void stopExploration()} disabled={trackingBusy} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#0d5962]/20 bg-white px-3 text-xs font-bold text-[#073c44] hover:bg-[#edf6f2] disabled:opacity-50"><Square className="h-3.5 w-3.5 fill-current" />{korean ? "탐험 종료" : "Stop exploration"}</button>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[#071f2c]/45 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" className="relative w-full max-w-md border border-[#0d5962]/15 bg-[#fffdf8] p-6 shadow-[0_30px_90px_rgba(7,31,44,.32)] sm:p-8">
            <button type="button" onClick={() => setConfirmOpen(false)} className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center text-[#698287] hover:bg-[#edf6f2]" aria-label="Close"><X className="h-5 w-5" /></button>
            <WoohyukmonGlassesIcon className="h-12 w-24" />
            <h3 className="mt-5 font-serif text-2xl font-semibold text-[#073c44]">{korean ? "한국 탐험을 시작하고 추억록 구성을 시작하시겠습니까?" : "Start exploring Korea and begin building your Memory Book?"}</h3>
            <p className="mt-3 text-sm leading-6 text-[#4c6769]">{korean ? "예를 누르면 위치 권한을 요청하고 탐험 기록을 시작합니다. 기존 장소·사진·별점·활동 데이터는 이미 별도로 보존되고 있습니다." : "Choosing Yes requests location permission and starts an exploration record. Your existing places, photos, ratings, and activity data are already stored separately."}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirmOpen(false)} className="min-h-11 border border-[#0d5962]/18 bg-white text-sm font-bold text-[#315b5f]">{korean ? "아니오" : "Not now"}</button>
              <button type="button" onClick={() => void beginExploration()} disabled={trackingBusy} className="min-h-11 bg-[#0d5962] text-sm font-bold text-white disabled:opacity-50">{trackingBusy ? (korean ? "시작 중…" : "Starting…") : (korean ? "예" : "Yes")}</button>
            </div>
          </section>
        </div>
      ) : null}

      {bookOpen ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[#071f2c]/55 p-3 backdrop-blur-md sm:p-6">
          <section className="relative flex max-h-[92svh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.4rem] border border-[#d4c8aa] bg-[#f7f0df] shadow-[0_35px_110px_rgba(7,31,44,.45)]">
            <div className="flex items-center justify-between border-b border-[#cdbf9f]/70 bg-[#ede1c5] px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-[#0d5962]" /><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c68b35]">K_LINE</p><p className="font-serif text-lg font-semibold text-[#073c44]">{korean ? "나의 한국 추억록" : "My Korea Memory Book"}</p></div></div>
              <button type="button" onClick={() => setBookOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/60 text-[#315b5f] hover:bg-white" aria-label="Close book"><X className="h-5 w-5" /></button>
            </div>

            <div key={pageIndex} className="memory-page-flip flex-1 overflow-y-auto bg-[linear-gradient(90deg,#fffaf0_0%,#fffdf7_48%,#efe5ce_50%,#fffdf7_52%,#fffaf0_100%)] p-5 sm:p-8 md:p-10">
              {pageIndex === 0 ? (
                <ProfilePage profile={profile} avatar={avatar} korean={korean} onChange={setProfile} onSave={saveProfile} saved={profileSaved} />
              ) : currentMemoryPage ? (
                <TimelinePage page={currentMemoryPage} korean={korean} />
              ) : recommendationPage ? (
                <RecommendationPage recommendation={recommendation} loading={recommendationBusy} korean={korean} />
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#cdbf9f]/70 bg-[#ede1c5] px-4 py-3 sm:px-6">
              <button type="button" disabled={pageIndex === 0} onClick={() => setPageIndex((value) => Math.max(0, value - 1))} className="inline-flex min-h-10 items-center gap-2 px-3 text-sm font-bold text-[#315b5f] disabled:opacity-30"><ChevronLeft className="h-4 w-4" />{korean ? "이전 장" : "Previous"}</button>
              <span className="text-xs font-bold text-[#698287]">{pageIndex + 1} / {totalBookPages}</span>
              <button type="button" disabled={pageIndex >= totalBookPages - 1} onClick={() => setPageIndex((value) => Math.min(totalBookPages - 1, value + 1))} className="inline-flex min-h-10 items-center gap-2 px-3 text-sm font-bold text-[#0d5962] disabled:opacity-30">{korean ? "다음 장" : "Next"}<ChevronRight className="h-4 w-4" /></button>
            </div>
          </section>
          <style>{`@keyframes memoryPageFlip{0%{opacity:.2;transform:perspective(1100px) rotateY(10deg) translateX(14px)}100%{opacity:1;transform:perspective(1100px) rotateY(0) translateX(0)}}.memory-page-flip{transform-origin:left center;animation:memoryPageFlip .38s ease-out}`}</style>
        </div>
      ) : null}
    </section>
  );
}

function ProfilePage({ avatar, korean, onChange, onSave, profile, saved }: { avatar: string; korean: boolean; onChange: (profile: MemoryProfile) => void; onSave: () => void; profile: MemoryProfile; saved: boolean }) {
  const fields: Array<{ key: keyof MemoryProfile; labelKo: string; labelEn: string; placeholderKo: string; placeholderEn: string }> = [
    { key: "name", labelKo: "이름", labelEn: "Name", placeholderKo: "이름", placeholderEn: "Your name" },
    { key: "nationality", labelKo: "국적", labelEn: "Nationality", placeholderKo: "예: Moldova", placeholderEn: "e.g. Moldova" },
    { key: "university", labelKo: "소속 대학", labelEn: "University", placeholderKo: "예: Jeonbuk National University", placeholderEn: "e.g. Jeonbuk National University" },
    { key: "major", labelKo: "전공", labelEn: "Major", placeholderKo: "전공", placeholderEn: "Your major" },
    { key: "languages", labelKo: "언어", labelEn: "Languages", placeholderKo: "예: Korean, English", placeholderEn: "e.g. Korean, English" },
    { key: "purpose", labelKo: "한국 방문·교환 목적", labelEn: "Why Korea?", placeholderKo: "한국에서 이루고 싶은 것", placeholderEn: "What brought you to Korea?" },
    { key: "interests", labelKo: "관심사", labelEn: "Interests", placeholderKo: "문화, 음식, 여행 등", placeholderEn: "Culture, food, travel…" },
    { key: "intro", labelKo: "한 줄 소개", labelEn: "One-line intro", placeholderKo: "나를 소개하는 한 문장", placeholderEn: "A short line about you" }
  ];

  return <div className="mx-auto max-w-3xl"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c68b35]">PAGE 01 · PROFILE</p>{avatar ? <img src={avatar} alt="Profile" className="mx-auto mt-5 h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg" /> : <div className="mx-auto mt-5 grid h-24 w-24 place-items-center rounded-full border-4 border-white bg-[#dcefe8] text-3xl font-serif text-[#0d5962]">{profile.name.slice(0, 1) || "K"}</div>}<h3 className="mt-4 font-serif text-3xl font-semibold text-[#073c44]">{profile.name || (korean ? "나의 프로필" : "My profile")}</h3><p className="mt-2 text-sm text-[#698287]">{korean ? "자동으로 채워진 내용을 확인하고 틀린 부분은 바로 수정하세요." : "Check the auto-filled profile and correct anything that is wrong."}</p></div><div className="mt-7 grid gap-4 sm:grid-cols-2">{fields.map((field) => <label key={field.key} className={field.key === "purpose" || field.key === "intro" ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-xs font-bold text-[#315b5f]">{korean ? field.labelKo : field.labelEn}</span><input value={profile[field.key]} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...profile, [field.key]: event.target.value })} placeholder={korean ? field.placeholderKo : field.placeholderEn} className="min-h-11 w-full border-b border-[#b8aa89] bg-transparent px-1 text-sm text-[#073c44] outline-none focus:border-[#0d5962]" /></label>)}</div><button type="button" onClick={onSave} className="mx-auto mt-7 inline-flex min-h-11 items-center gap-2 bg-[#0d5962] px-5 text-sm font-bold text-white"><Save className="h-4 w-4" />{saved ? (korean ? "저장됨" : "Saved") : (korean ? "프로필 저장" : "Save profile")}</button></div>;
}

function TimelinePage({ korean, page }: { korean: boolean; page: MemoryPage }) {
  return <div className="mx-auto max-w-3xl"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c68b35]">KOREA JOURNEY</p><h3 className="mt-3 font-serif text-3xl font-semibold text-[#073c44]">{displayDate(page.date, korean)}</h3></div><div className="mt-8 grid gap-5">{page.entries.map((entry) => <article key={entry.id} className="border-b border-[#cdbf9f]/70 pb-5"><div className="flex items-start gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e5efe9] text-[#0d5962]">{entry.kind === "place" ? <MapPin className="h-5 w-5" /> : entry.kind === "route" ? <Route className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><h4 className="font-serif text-xl font-semibold text-[#073c44]">{entry.title}</h4><p className="mt-1 text-xs leading-5 text-[#698287]">{entry.subtitle}</p>{entry.rating ? <div className="mt-2 flex gap-0.5" aria-label={`${entry.rating} out of 5 stars`}>{[1,2,3,4,5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= entry.rating! ? "fill-[#d49b42] text-[#d49b42]" : "text-[#b9ae93]"}`} />)}</div> : null}</div></div>{entry.photos.length ? <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">{entry.photos.slice(0,5).map((photo) => <img key={photo} src={photo} alt="Memory" className="aspect-square w-full rounded-lg object-cover" />)}</div> : null}</article>)}</div></div>;
}

function RecommendationPage({ korean, loading, recommendation }: { korean: boolean; loading: boolean; recommendation: string }) {
  return <div className="mx-auto flex min-h-[30rem] max-w-3xl flex-col items-center justify-center text-center"><WoohyukmonGlassesIcon className="h-20 w-36 drop-shadow-[0_12px_10px_rgba(7,31,44,.18)]" /><p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#c68b35]">WOOHYUKMON NEXT STEP</p><h3 className="mt-3 font-serif text-3xl font-semibold text-[#073c44]">{korean ? "다음에는 어디로 갈까요?" : "Where should you go next?"}</h3><p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-[#4c6769]">{loading ? (korean ? "우혁몬이 장소·별점·활동·이동 기록을 읽고 있습니다…" : "Woohyukmon is reading your places, ratings, activities, and movement…") : recommendation || (korean ? "기록이 조금 더 쌓이면 우혁몬이 다음 경험을 추천합니다." : "Once you have a little more history, Woohyukmon will recommend your next experience.")}</p></div>;
}
