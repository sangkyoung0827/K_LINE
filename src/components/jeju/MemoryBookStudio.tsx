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
      () => reject(new Error("Location permission was not granted.")),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 }
    );
  });
}

function parseStoredProfile(raw: string | null) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<MemoryProfile>;
    return Object.fromEntries(
      Object.keys(emptyProfile).map((key) => [
        key,
        typeof value[key as keyof MemoryProfile] === "string" ? value[key as keyof MemoryProfile] : ""
      ])
    ) as MemoryProfile;
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

  const applyProfileResponse = useCallback((profileResult: ProfileResponse) => {
    setProfileResponse(profileResult);
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
    setProfile((current) => {
      const hasCurrentInput = Object.values(current).some((value) => value.trim().length > 0);
      if (hasCurrentInput) return current;
      return stored ? { ...defaults, ...stored } : defaults;
    });
    return profileResult;
  }, []);

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
      () => setTrackingMessage(
        korean
          ? "위치 기록이 잠시 멈췄습니다. 추억록과 기존 기록은 계속 사용할 수 있습니다."
          : "Location updates paused. Your Memory Book and saved records still work."
      ),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 25_000 }
    );
  }

  const loadData = useCallback(async () => {
    const [profileResult, placesResult, trackingResult, activitiesResult, overviewResult] = await Promise.all([
      readJejuResponse<ProfileResponse>("/api/jeju/profile"),
      readJejuResponse<PersonalPlacesResponse>("/api/jeju/personal-places"),
      readJejuResponse<JejuExploreTracking>("/api/jeju/explore/track"),
      fetch("/api/activity-history/records").then((response) => response.json() as Promise<ActivityRecordsResponse>),
      readJejuResponse<OverviewResponse>("/api/jeju/overview")
    ]);

    applyProfileResponse(profileResult);
    setAvatar(overviewResult.user?.image ?? "");
    setPersonalPlaces(placesResult.records ?? []);
    setActivities(activitiesResult.records ?? []);
    setTracking(trackingResult);
    activeSessionRef.current = trackingResult.activeSession?.id ?? null;

    const startedKey = `kline-memory-book-started:${profileResult.user.email}`;
    const explorationKey = `kline-exploration-enabled:${profileResult.user.email}`;
    const started = window.localStorage.getItem(startedKey) === "1";
    const explorationEnabled = window.localStorage.getItem(explorationKey) === "1";
    setBookStarted((current) => current || started);

    if (explorationEnabled && trackingResult.activeSession) {
      startWatch(trackingResult.activeSession.id);
    }
  }, [applyProfileResponse, korean]);

  useEffect(() => {
    loadData().catch(() => setTrackingMessage(korean ? "개인 기록을 불러오지 못했습니다." : "Your private records could not load."));
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [korean, loadData]);

  async function beginExploration() {
    if (trackingBusy) return;

    // Opening the Memory Book is the primary user action. It must never wait for
    // geolocation, profile retrieval, or creation of a tracking session.
    setBookStarted(true);
    setConfirmOpen(false);
    setPageIndex(0);
    setBookOpen(true);
    setTrackingMessage(
      korean
        ? "추억록 1페이지를 열었습니다. 위치 기록은 백그라운드에서 별도로 시작합니다."
        : "Memory Book page 1 is open. Location recording will start separately in the background."
    );

    setTrackingBusy(true);
    try {
      const profileResult = profileResponse ?? applyProfileResponse(await readJejuResponse<ProfileResponse>("/api/jeju/profile"));
      window.localStorage.setItem(`kline-memory-book-started:${profileResult.user.email}`, "1");

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
      window.localStorage.setItem(`kline-exploration-enabled:${profileResult.user.email}`, "1");
      setTrackingMessage(
        korean
          ? "탐험 위치 기록도 시작되었습니다. 웹에서는 이 페이지가 열려 있는 동안 기록됩니다."
          : "Exploration location recording also started. On the web, it records while this page remains open."
      );
      await loadData();
    } catch (error) {
      setTrackingMessage(
        korean
          ? "추억록은 정상적으로 시작되었습니다. 위치 권한을 허용하지 않았거나 위치 기록을 시작하지 못했지만, 프로필 작성과 기존 장소·별점·사진·활동 기록은 그대로 사용할 수 있습니다."
          : "Your Memory Book started normally. Location recording did not start or permission was not granted, but your profile and existing places, ratings, photos, and activity history still work."
      );
      console.warn("Memory Book location tracking did not start", error);
    } finally {
      setTrackingBusy(false);
    }
  }

  async function stopExploration() {
    if (trackingBusy) return;
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
      if (profileResponse) window.localStorage.setItem(`kline-exploration-enabled:${profileResponse.user.email}`, "0");
      setTrackingMessage(korean ? "탐험을 종료했습니다. 지금까지의 기록은 그대로 보존됩니다." : "Exploration stopped. Everything recorded so far remains saved.");
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
    if (!profileResponse) {
      setProfileSaved(false);
      setTrackingMessage(korean ? "계정 정보를 불러오는 중입니다. 잠시 후 다시 저장해주세요." : "Your account is still loading. Please save again in a moment.");
      return;
    }
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

  const totalBookPages = 2 + memoryPages.length + 1;
  const totalSpreads = Math.ceil(totalBookPages / 2);
  const recommendationLeafIndex = totalBookPages - 1;
  const recommendationSpreadIndex = Math.floor(recommendationLeafIndex / 2);
  const recommendationPage = pageIndex === recommendationSpreadIndex;
  const leftLeafIndex = pageIndex * 2;
  const rightLeafIndex = leftLeafIndex + 1;

  const loadRecommendation = useCallback(async () => {
    if (recommendationLoadedRef.current || recommendationBusy || (!personalPlaces.length && !activities.length && !(tracking?.points.length))) return;
    recommendationLoadedRef.current = true;
    setRecommendationBusy(true);
    setRecommendation("");
    try {
      const lastPoint = tracking?.points.at(-1);
      const response = await fetch("/api/jeju/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLocation: lastPoint ? { latitude: lastPoint.latitude, longitude: lastPoint.longitude } : null,
          history: [],
          message: korean
            ? "내가 저장한 방문 장소와 별점, 활동 기록, 이동 기록을 바탕으로 다음에 할 만한 한국 경험 3가지만 추천해줘. 높은 별점을 준 경험과 비슷한 것을 가장 우선하고, 아직 안 가본 가까운 장소와 내 관심사를 다음으로 고려해줘. ECC나 한활 활동 이력은 취향 참고용으로만 사용하고, 내가 요청하지 않는 한 해당 동아리 재참여를 추천하지 마. 각 추천은 이유를 한 문장으로 설명해줘."
            : "Recommend exactly three next experiences in Korea from my saved places and ratings, activity history, and movement record. Prioritize experiences similar to things I rated highly, then nearby unvisited places and my interests. Use ECC or Hanhwal history only as a taste signal; do not recommend rejoining or future club participation unless I ask. Give one short reason for each recommendation."
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

  function renderLeaf(leafIndex: number) {
    if (leafIndex === 0) {
      return (
        <ProfilePage
          profile={profile}
          avatar={avatar}
          korean={korean}
          onChange={setProfile}
          onSave={saveProfile}
          saved={profileSaved}
        />
      );
    }

    if (leafIndex === 1) {
      return (
        <JourneyStartPage
          korean={korean}
          personalPlaces={personalPlaces}
          activities={activities}
          tracking={tracking}
        />
      );
    }

    const memoryIndex = leafIndex - 2;

    if (memoryIndex >= 0 && memoryIndex < memoryPages.length) {
      return <TimelinePage page={memoryPages[memoryIndex]} korean={korean} />;
    }

    if (leafIndex === recommendationLeafIndex) {
      return (
        <RecommendationPage
          recommendation={recommendation}
          loading={recommendationBusy}
          korean={korean}
        />
      );
    }

    return <MemoryBlankPage korean={korean} />;
  }

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#ffffff_0%,#f4faf7_46%,#edf7f3_100%)]">
      <div className="relative grid min-h-[clamp(40rem,74vh,50rem)] place-items-center px-4 py-10 sm:px-8 md:py-14">
        <div className="relative [perspective:1500px]">
          <button
            type="button"
            onClick={onBookClick}
            className="group relative block w-[min(86vw,31rem)] text-left focus:outline-none sm:w-[min(72vw,34rem)]"
            aria-label={korean ? "추억록 열기" : "Open memory book"}
          >
            <div className="relative aspect-[4/5] origin-left transition duration-500 [transform:rotateY(-8deg)_rotateX(2deg)] group-hover:[transform:rotateY(-3deg)_rotateX(1deg)_translateY(-7px)]">
              <div className="absolute inset-y-2 -right-4 w-6 rounded-r-xl bg-[repeating-linear-gradient(90deg,#fbf5e4_0,#fbf5e4_2px,#e6dcc3_2px,#e6dcc3_3px)] shadow-xl" />
              <div className="absolute inset-0 overflow-hidden rounded-r-[1.7rem] border border-[#071f2c]/30 bg-[radial-gradient(circle_at_72%_22%,rgba(126,216,225,.24),transparent_34%),linear-gradient(145deg,#071f2c,#0d5962_60%,#124451)] shadow-[24px_32px_65px_rgba(7,31,44,.28)]">
                <div className="absolute inset-y-0 left-0 w-9 bg-black/20 shadow-[inset_-6px_0_12px_rgba(255,255,255,.08)]" />
                <div className="absolute left-12 right-9 top-10 border-t border-[#f0c56b]/55" />
                <div className="absolute bottom-10 left-12 right-9 border-t border-[#f0c56b]/35" />

                <div className="absolute inset-x-14 top-[20%] text-center text-[#f7e7b4]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em]">K_LINE</p>
                  <p className="mt-4 font-serif text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                    {korean ? "한국 추억록" : "Korea Memory Book"}
                  </p>
                  <p className="mt-3 text-xs text-white/62">Places · Activities · Memories</p>
                </div>

                <div className="absolute left-[20%] top-[53%] z-10 flex items-center">
                  <span className="relative flex h-24 w-40 items-center justify-center transition duration-300 group-hover:scale-105">
                    <span className="absolute inset-4 rounded-full bg-white/10 blur-xl" />
                    <WoohyukmonGlassesIcon className="relative h-20 w-36 drop-shadow-[0_14px_12px_rgba(0,0,0,.35)]" />
                  </span>
                  <span className="memory-book-speech relative ml-[-0.8rem] max-w-[13rem] rounded-[1.4rem] bg-white px-4 py-3 text-xs font-bold leading-5 text-[#073c44] shadow-[0_12px_30px_rgba(7,31,44,.22)] sm:max-w-[15rem] sm:text-sm">
                    {korean
                      ? "여기를 눌러 한국생활 추억록 만들기를 시작하세요"
                      : "Click here to start building your Korea Memory Book"}
                  </span>
                </div>

                {tracking?.activeSession ? (
                  <div className="absolute inset-x-12 bottom-20 z-20 flex justify-center">
                    <span
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#071f2c]/72 px-3 py-2 text-[11px] font-bold text-white/90 backdrop-blur"
                    >
                      <Route className="h-3.5 w-3.5" />
                      {korean ? "탐험 기록 중" : "Exploration recording"}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void stopExploration();
                        }}
                        disabled={trackingBusy}
                        className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/12 px-2 py-1 hover:bg-white/20 disabled:opacity-50"
                      >
                        <Square className="h-3 w-3 fill-current" />
                        {korean ? "종료" : "Stop"}
                      </button>
                    </span>
                  </div>
                ) : null}

                <div className="absolute bottom-14 inset-x-10 text-center text-[11px] font-semibold tracking-[0.16em] text-white/58">
                  {bookStarted ? "CLICK TO CONTINUE" : "CLICK TO START"}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[#071f2c]/45 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md border border-[#0d5962]/15 bg-[#fffdf8] p-6 shadow-[0_30px_90px_rgba(7,31,44,.32)] sm:p-8"
          >
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center text-[#698287] hover:bg-[#edf6f2]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <WoohyukmonGlassesIcon className="h-12 w-24" />
            <h3 className="mt-5 font-serif text-2xl font-semibold text-[#073c44]">
              {korean
                ? "한국 탐험을 시작하고 추억록 구성을 시작하시겠습니까?"
                : "Start exploring Korea and begin building your Memory Book?"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#4c6769]">
              {korean
                ? "예를 누르면 즉시 추억록 첫 장이 열립니다. 위치 기록은 별도로 시작되며, 위치 권한이 없어도 추억록은 정상적으로 사용할 수 있습니다."
                : "Choosing Yes opens the first spread immediately. Location tracking starts separately, and the Memory Book still works without location permission."}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="min-h-11 border border-[#0d5962]/18 bg-white text-sm font-bold text-[#315b5f]"
              >
                {korean ? "아니오" : "Not now"}
              </button>
              <button
                type="button"
                onClick={() => void beginExploration()}
                className="min-h-11 bg-[#0d5962] text-sm font-bold text-white"
              >
                {korean ? "예" : "Yes"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {bookOpen ? (
        <div className="memory-book-overlay fixed inset-0 z-[95] flex items-center justify-center bg-[#071f2c]/58 p-2 backdrop-blur-md sm:p-4">
          <section className="memory-book-open relative flex max-h-[96svh] w-full max-w-[82rem] flex-col">
            <div className="mb-2 flex items-center justify-between px-1 text-white">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f0c56b]">K_LINE</p>
                  <p className="font-serif text-lg font-semibold">
                    {korean ? "나의 한국 추억록" : "My Korea Memory Book"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white hover:bg-white/20"
                aria-label="Close book"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-auto rounded-[1.4rem]">
              <div
                key={pageIndex}
                className="memory-page-flip relative mx-auto grid h-[min(78svh,47rem)] min-h-[40rem] min-w-[760px] w-full grid-cols-2 overflow-hidden border border-[#d4c8aa] bg-[#f7f0df] shadow-[0_35px_110px_rgba(7,31,44,.45)]"
              >
                <article className="relative min-w-0 overflow-y-auto bg-[linear-gradient(100deg,#fffaf0_0%,#fffdf7_88%,#f2e8d2_100%)]">
                  <BookPageHeader pageNumber={leftLeafIndex + 1} />
                  <div className="px-7 pb-8 pt-5 sm:px-9">
                    {renderLeaf(leftLeafIndex)}
                  </div>
                </article>

                <article className="relative min-w-0 overflow-y-auto bg-[linear-gradient(80deg,#f2e8d2_0%,#fffdf7_12%,#fffaf0_100%)]">
                  <BookPageHeader pageNumber={rightLeafIndex + 1} />
                  <div className="px-7 pb-8 pt-5 sm:px-9">
                    {rightLeafIndex < totalBookPages ? renderLeaf(rightLeafIndex) : <MemoryBlankPage korean={korean} />}
                  </div>
                </article>

                <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px -translate-x-1/2 bg-[#cdbf9f]/55 shadow-[0_0_22px_10px_rgba(116,95,56,.14)]" />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between rounded-full bg-[#071f2c]/72 px-3 py-2 text-white backdrop-blur sm:px-5">
              <button
                type="button"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
                className="inline-flex min-h-9 items-center gap-2 px-2 text-sm font-bold disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
                {korean ? "이전 장" : "Previous"}
              </button>
              <span className="text-xs font-bold text-white/72">
                {pageIndex + 1} / {totalSpreads}
              </span>
              <button
                type="button"
                disabled={pageIndex >= totalSpreads - 1}
                onClick={() => setPageIndex((value) => Math.min(totalSpreads - 1, value + 1))}
                className="inline-flex min-h-9 items-center gap-2 px-2 text-sm font-bold disabled:opacity-30"
              >
                {korean ? "다음 장" : "Next"}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          <style>{`
            @keyframes memoryBookOpen {
              0% { opacity: 0; transform: perspective(1500px) rotateY(-14deg) scale(.94); }
              100% { opacity: 1; transform: perspective(1500px) rotateY(0) scale(1); }
            }
            @keyframes memoryPageFlip {
              0% { opacity: .3; transform: perspective(1500px) rotateY(9deg); }
              100% { opacity: 1; transform: perspective(1500px) rotateY(0); }
            }
            .memory-book-open {
              transform-origin: center center;
              animation: memoryBookOpen .46s cubic-bezier(.2,.75,.2,1);
            }
            .memory-page-flip {
              transform-origin: center center;
              animation: memoryPageFlip .34s ease-out;
            }
            .memory-book-speech::before {
              content: "";
              position: absolute;
              left: -12px;
              top: 50%;
              width: 24px;
              height: 24px;
              background: white;
              transform: translateY(-50%) rotate(45deg);
              border-radius: 4px;
              z-index: -1;
            }
          `}</style>
        </div>
      ) : null}
    </section>
  );
}

function BookPageHeader({ pageNumber }: { pageNumber: number }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#cdbf9f]/65 bg-[#fffaf0]/94 px-7 py-3 backdrop-blur sm:px-9">
      <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-[#a77a34]">KOREA MEMORY BOOK</span>
      <span className="text-[10px] font-semibold tracking-[0.16em] text-[#9c8c6e]">
        {String(pageNumber).padStart(2, "0")}
      </span>
    </div>
  );
}

function ProfilePage({
  avatar,
  korean,
  onChange,
  onSave,
  profile,
  saved
}: {
  avatar: string;
  korean: boolean;
  onChange: (profile: MemoryProfile) => void;
  onSave: () => void;
  profile: MemoryProfile;
  saved: boolean;
}) {
  const primaryFields: Array<{
    key: keyof MemoryProfile;
    labelKo: string;
    labelEn: string;
    placeholderKo: string;
    placeholderEn: string;
  }> = [
    { key: "name", labelKo: "이름", labelEn: "Name", placeholderKo: "이름", placeholderEn: "Your name" },
    { key: "nationality", labelKo: "국적", labelEn: "Nationality", placeholderKo: "예: Moldova", placeholderEn: "e.g. Moldova" },
    { key: "university", labelKo: "소속 대학", labelEn: "University", placeholderKo: "예: Jeonbuk National University", placeholderEn: "e.g. Jeonbuk National University" },
    { key: "major", labelKo: "전공", labelEn: "Major", placeholderKo: "전공", placeholderEn: "Your major" },
    { key: "languages", labelKo: "언어", labelEn: "Languages", placeholderKo: "예: Korean, English", placeholderEn: "e.g. Korean, English" }
  ];

  return (
    <div className="mx-auto w-full max-w-[31rem]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c68b35]">
            {korean ? "첫 페이지" : "FIRST PAGE"}
          </p>
          <h3 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.03em] text-[#073c44]">
            {korean ? "프로필 설정" : "Profile setup"}
          </h3>
          <p className="mt-2 max-w-sm text-xs leading-5 text-[#698287]">
            {korean
              ? "자동으로 채워진 내용을 확인하고 틀린 부분은 수정하세요."
              : "Check the auto-filled profile and correct anything that is wrong."}
          </p>
        </div>
        <WoohyukmonGlassesIcon className="h-12 w-20 shrink-0 opacity-80" />
      </div>

      <div className="mt-6 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-5">
        <div className="min-w-0">
          <div className="aspect-[4/5] w-full overflow-hidden rounded-xl border border-[#cdbf9f]/75 bg-[#e5efe9] shadow-[0_10px_22px_rgba(7,31,44,.08)]">
            {avatar ? (
              <img src={avatar} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center font-serif text-4xl text-[#0d5962]">
                {profile.name.slice(0, 1) || "K"}
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-[10px] font-semibold text-[#8b806d]">
            {korean ? "계정 프로필 사진" : "Account photo"}
          </p>
        </div>

        <div className="grid min-w-0 content-start gap-3">
          {primaryFields.map((field) => (
            <label key={field.key} className="grid min-w-0 grid-cols-[4.6rem_minmax(0,1fr)] items-center gap-2">
              <span className="text-[11px] font-bold text-[#49676a]">
                {korean ? field.labelKo : field.labelEn}
              </span>
              <input
                value={profile[field.key]}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onChange({ ...profile, [field.key]: event.target.value })
                }
                placeholder={korean ? field.placeholderKo : field.placeholderEn}
                className="min-h-9 min-w-0 rounded-lg border border-[#d7cdb5] bg-white/55 px-3 text-xs text-[#073c44] outline-none focus:border-[#0d5962]"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {[
          {
            key: "purpose" as const,
            labelKo: "한국 방문·교환 목적",
            labelEn: "Why Korea?",
            placeholderKo: "한국에서 이루고 싶은 것",
            placeholderEn: "What brought you to Korea?"
          },
          {
            key: "interests" as const,
            labelKo: "관심사",
            labelEn: "Interests",
            placeholderKo: "문화, 음식, 여행 등",
            placeholderEn: "Culture, food, travel…"
          }
        ].map((field) => (
          <label key={field.key}>
            <span className="mb-1 block text-[11px] font-bold text-[#49676a]">
              {korean ? field.labelKo : field.labelEn}
            </span>
            <input
              value={profile[field.key]}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...profile, [field.key]: event.target.value })
              }
              placeholder={korean ? field.placeholderKo : field.placeholderEn}
              className="min-h-9 w-full rounded-lg border border-[#d7cdb5] bg-white/55 px-3 text-xs text-[#073c44] outline-none focus:border-[#0d5962]"
            />
          </label>
        ))}

        <label>
          <span className="mb-1 block text-[11px] font-bold text-[#49676a]">
            {korean ? "한 줄 소개" : "One-line intro"}
          </span>
          <textarea
            value={profile.intro}
            onChange={(event) => onChange({ ...profile, intro: event.target.value })}
            placeholder={korean ? "나를 소개하는 짧은 문장" : "A short line about you"}
            rows={3}
            className="w-full resize-none rounded-xl border border-[#d7cdb5] bg-white/55 px-3 py-2 text-xs leading-5 text-[#073c44] outline-none focus:border-[#0d5962]"
          />
        </label>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#0d5962] px-4 text-xs font-bold text-white"
        >
          <Save className="h-4 w-4" />
          {saved ? (korean ? "저장됨" : "Saved") : korean ? "프로필 저장" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

function JourneyStartPage({
  activities,
  korean,
  personalPlaces,
  tracking
}: {
  activities: ActivityRecord[];
  korean: boolean;
  personalPlaces: JejuPersonalPlaceRecord[];
  tracking: JejuExploreTracking | null;
}) {
  const photos = personalPlaces.flatMap((place) => place.photos.map((photo) => photo.publicUrl));
  const recentPlaces = personalPlaces.slice(0, 3);
  const recentActivities = activities.slice(0, 2);

  return (
    <div className="mx-auto w-full max-w-[31rem]">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c68b35]">
        {korean ? "추억록 시작" : "START YOUR MEMORY BOOK"}
      </p>
      <h3 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.03em] text-[#073c44]">
        {korean ? "한국생활의 순간들을 모아보세요" : "Collect your moments in Korea"}
      </h3>
      <p className="mt-2 text-xs leading-5 text-[#698287]">
        {korean
          ? "지도에 저장한 장소, 활동기록, 별점과 직접 올린 사진이 자동으로 이 책의 다음 장을 채웁니다."
          : "Saved places, activity history, ratings, and your own photos automatically fill the pages that follow."}
      </p>

      <div className="mt-6 grid gap-3">
        <section className="rounded-xl border border-[#d7cdb5] bg-white/48 p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-[#073c44]">
              <MapPin className="h-4 w-4 text-[#0d5962]" />
              {korean ? "방문한 장소" : "Visited places"}
            </span>
            <span className="text-[11px] font-bold text-[#a77a34]">{personalPlaces.length}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {recentPlaces.length ? (
              recentPlaces.map((place) => (
                <span key={place.id} className="max-w-full truncate rounded-full bg-[#edf5f0] px-3 py-1.5 text-[11px] font-semibold text-[#315b5f]">
                  {place.placeName}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-[#8d8779]">
                {korean ? "지도에서 장소를 저장하면 여기에 나타납니다." : "Saved map places will appear here."}
              </span>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#d7cdb5] bg-white/48 p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-[#073c44]">
              <Sparkles className="h-4 w-4 text-[#0d5962]" />
              {korean ? "활동 기록" : "Activity history"}
            </span>
            <span className="text-[11px] font-bold text-[#a77a34]">{activities.length}</span>
          </div>
          <div className="mt-3 grid gap-2">
            {recentActivities.length ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="truncate text-[11px] font-semibold text-[#49676a]">
                  · {activity.activityTitle}
                </div>
              ))
            ) : (
              <span className="text-[11px] text-[#8d8779]">
                {korean ? "참여 활동 기록이 자동으로 쌓입니다." : "Your activity history will accumulate automatically."}
              </span>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <section className="rounded-xl border border-[#d7cdb5] bg-white/48 p-4">
            <span className="text-xs font-bold text-[#073c44]">{korean ? "사진" : "Photos"}</span>
            <p className="mt-1 text-2xl font-serif font-semibold text-[#0d5962]">{photos.length}</p>
            <p className="mt-1 text-[10px] leading-4 text-[#8d8779]">
              {korean ? "직접 업로드한 사진" : "Your uploaded photos"}
            </p>
          </section>
          <section className="rounded-xl border border-[#d7cdb5] bg-white/48 p-4">
            <span className="text-xs font-bold text-[#073c44]">{korean ? "이동 기록" : "Route points"}</span>
            <p className="mt-1 text-2xl font-serif font-semibold text-[#0d5962]">{tracking?.points.length ?? 0}</p>
            <p className="mt-1 text-[10px] leading-4 text-[#8d8779]">
              {korean ? "탐험 중 기록된 포인트" : "Recorded exploration points"}
            </p>
          </section>
        </div>

        {photos.length ? (
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 3).map((photo) => (
              <img key={photo} src={photo} alt="Memory" className="aspect-[4/3] w-full rounded-lg object-cover" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TimelinePage({ korean, page }: { korean: boolean; page: MemoryPage }) {
  return (
    <div className="mx-auto w-full max-w-[31rem]">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c68b35]">KOREA JOURNEY</p>
      <h3 className="mt-2 font-serif text-2xl font-semibold text-[#073c44]">
        {displayDate(page.date, korean)}
      </h3>

      <div className="mt-5 grid gap-4">
        {page.entries.map((entry) => (
          <article key={entry.id} className="rounded-xl border border-[#d7cdb5] bg-white/42 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e5efe9] text-[#0d5962]">
                {entry.kind === "place" ? (
                  <MapPin className="h-4 w-4" />
                ) : entry.kind === "route" ? (
                  <Route className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="break-words font-serif text-lg font-semibold text-[#073c44]">{entry.title}</h4>
                <p className="mt-1 break-words text-[11px] leading-5 text-[#698287]">{entry.subtitle}</p>
                {entry.rating ? (
                  <div className="mt-2 flex gap-0.5" aria-label={`${entry.rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3.5 w-3.5 ${
                          star <= entry.rating!
                            ? "fill-[#d49b42] text-[#d49b42]"
                            : "text-[#b9ae93]"
                        }`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            {entry.photos.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {entry.photos.slice(0, 6).map((photo) => (
                  <img key={photo} src={photo} alt="Memory" className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function RecommendationPage({
  korean,
  loading,
  recommendation
}: {
  korean: boolean;
  loading: boolean;
  recommendation: string;
}) {
  return (
    <div className="mx-auto flex min-h-[31rem] w-full max-w-[31rem] flex-col items-center justify-center text-center">
      <WoohyukmonGlassesIcon className="h-20 w-32 drop-shadow-[0_12px_10px_rgba(7,31,44,.18)]" />
      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#c68b35]">
        WOOHYUKMON NEXT STEP
      </p>
      <h3 className="mt-3 font-serif text-2xl font-semibold text-[#073c44]">
        {korean ? "다음에는 어디로 갈까요?" : "Where should you go next?"}
      </h3>
      <p className="mt-4 max-w-md whitespace-pre-wrap text-xs leading-6 text-[#4c6769]">
        {loading
          ? korean
            ? "우혁몬이 장소·별점·활동·이동 기록을 읽고 있습니다…"
            : "Woohyukmon is reading your places, ratings, activities, and movement…"
          : recommendation ||
            (korean
              ? "기록이 조금 더 쌓이면 우혁몬이 다음 경험을 추천합니다."
              : "Once you have a little more history, Woohyukmon will recommend your next experience.")}
      </p>
    </div>
  );
}

function MemoryBlankPage({ korean }: { korean: boolean }) {
  return (
    <div className="flex min-h-[31rem] items-center justify-center text-center">
      <div>
        <p className="font-serif text-2xl font-semibold text-[#0d5962]/35">K_LINE</p>
        <p className="mt-2 text-[11px] text-[#8d8779]">
          {korean ? "다음 추억을 기다리는 페이지입니다." : "A page waiting for your next memory."}
        </p>
      </div>
    </div>
  );
}
