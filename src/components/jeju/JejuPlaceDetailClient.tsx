"use client";

import { CheckCircle2, LocateFixed, MapPin, Send, Star, Upload, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { JejuShell } from "@/components/jeju/JejuShell";
import { formatJejuDate, jejuCategoryLabels, placeTitle, readJejuResponse } from "@/components/jeju/jeju-client";
import type { JejuAccess, JejuPlace, JejuReview, JejuReviewPhoto, JejuVisit } from "@/lib/jeju/types";

type DetailResponse = {
  access: JejuAccess;
  latestVisit: JejuVisit | null;
  place: JejuPlace;
  reviews: JejuReview[];
  visited: boolean;
};

type UploadedPhoto = Pick<JejuReviewPhoto, "publicUrl" | "storagePath">;

function emptyReview() {
  return {
    atmosphereRating: 5,
    couldBeBetter: "",
    foodRating: 5,
    overallRating: 5,
    priceRating: 5,
    reviewText: "",
    whatLiked: "",
    wouldRecommend: true
  };
}

export function JejuPlaceDetailClient({ placeId }: { placeId: string }) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [error, setError] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState("");
  const [review, setReview] = useState(emptyReview);
  const [photos, setPhotos] = useState<File[]>([]);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const load = useCallback(() => {
    return readJejuResponse<DetailResponse>(`/api/jeju/places/${placeId}`)
      .then((response) => {
        setDetail(response);
        const own = response.reviews.find((item) => item.userEmail === response.access.email);
        if (own) {
          setReview({
            atmosphereRating: own.atmosphereRating,
            couldBeBetter: own.couldBeBetter,
            foodRating: own.foodRating ?? 5,
            overallRating: own.overallRating,
            priceRating: own.priceRating,
            reviewText: own.reviewText,
            whatLiked: own.whatLiked,
            wouldRecommend: own.wouldRecommend
          });
        }
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "This place could not load."));
  }, [placeId]);

  useEffect(() => { void load(); }, [load]);

  function checkIn() {
    if (!navigator.geolocation) {
      setCheckinMessage("This browser does not support location. Try a mobile browser with location access enabled.");
      return;
    }
    setCheckingIn(true);
    setCheckinMessage("Requesting your location only for this check-in…");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await readJejuResponse<{ success: boolean; distanceMeters: number }>("/api/jeju/visits", {
            body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, placeId }),
            method: "POST"
          });
          if (result.success) {
            setCheckinMessage(`You visited this place. Check-in confirmed within ${result.distanceMeters} m.`);
            await load();
          } else {
            setCheckinMessage(`You need to be closer to this place to check in. Current distance: ${result.distanceMeters} m.`);
          }
        } catch (requestError) {
          setCheckinMessage(requestError instanceof Error ? requestError.message : "Check-in could not be completed.");
        } finally {
          setCheckingIn(false);
        }
      },
      () => {
        setCheckingIn(false);
        setCheckinMessage("Location permission was not granted. K_LINE does not request it again until you tap Check in.");
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 }
    );
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setSavingReview(true);
    setReviewMessage("Uploading your review…");
    try {
      const uploaded = await Promise.all(photos.slice(0, 5).map((file) => uploadReviewPhoto(file)));
      await readJejuResponse<{ review: JejuReview }>("/api/jeju/reviews", {
        body: JSON.stringify({ ...review, photos: uploaded, placeId }),
        method: "POST"
      });
      setPhotos([]);
      setReviewMessage("Your Jeju review has been saved.");
      await load();
    } catch (requestError) {
      setReviewMessage(requestError instanceof Error ? requestError.message : "Your review could not be saved.");
    } finally {
      setSavingReview(false);
    }
  }

  const ownReview = useMemo(() => detail?.reviews.find((item) => item.userEmail === detail.access.email) ?? null, [detail]);

  return (
    <JejuShell title={detail ? placeTitle(detail.place) : "Place details"} description={detail ? `${jejuCategoryLabels[detail.place.category]} · ${detail.place.address || "Jeju"}` : "Loading confirmed Jeju Explorer place information."} actions={<Link href="/jeju/discover" className="inline-flex min-h-10 items-center justify-center border border-[#0d5962]/25 bg-white px-4 text-sm font-bold text-[#0d5962] transition hover:bg-[#e8f4ef]">Back to Discover</Link>}>
      {error ? <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {!detail && !error ? <div className="min-h-[420px] animate-pulse bg-[#d7ebe6]" /> : null}
      {detail ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.32fr)_minmax(18rem,.68fr)]">
          <div className="grid gap-6">
            <section className="overflow-hidden border border-[#0d5962]/12 bg-white/82">
              {detail.place.thumbnailUrl ? <img src={detail.place.thumbnailUrl} alt={placeTitle(detail.place)} className="aspect-[16/9] w-full object-cover" /> : <div className="grid aspect-[16/9] place-items-center bg-[#d9ece3] font-serif text-4xl font-semibold text-[#0d5962]">JEJU</div>}
              <div className="p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-[#dcedea] px-3 py-1 text-xs font-bold uppercase text-[#0d5962]">{jejuCategoryLabels[detail.place.category]}</span>{detail.place.reviewCount > 0 ? <span className="inline-flex items-center gap-1 text-sm font-bold text-[#a66e1d]"><Star aria-hidden className="h-4 w-4 fill-current" /> {detail.place.averageRating.toFixed(1)} / 5 · {detail.place.reviewCount} reviews</span> : <span className="text-xs font-semibold text-[#4c6769]">No reviews yet</span>}</div><h2 className="mt-4 font-serif text-3xl font-semibold text-[#073c44]">{placeTitle(detail.place)}</h2>{detail.place.nameEn && detail.place.name !== detail.place.nameEn ? <p className="mt-1 text-sm text-[#4c6769]">{detail.place.name}</p> : null}<p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#315b5f]">{detail.place.descriptionEn || detail.place.description || "A confirmed Jeju Explorer place."}</p>{detail.place.tags.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{detail.place.tags.map((tag) => <span key={tag} className="bg-[#e9f4ef] px-2 py-1 text-xs font-semibold text-[#315b5f]">#{tag}</span>)}</div> : null}</div>
            </section>

            <section className="border border-[#0d5962]/12 bg-white/78 p-4 sm:p-6">
              <h2 className="font-serif text-2xl font-semibold text-[#073c44]">International student reviews</h2>
              {detail.reviews.length > 0 ? <div className="mt-4 grid gap-3">{detail.reviews.map((item) => <ReviewCard key={item.id} review={item} />)}</div> : <p className="mt-3 text-sm leading-6 text-[#4c6769]">The first verified visit can become the first review here.</p>}
            </section>

            {detail.visited ? <ReviewForm detail={detail} ownReview={ownReview} photos={photos} review={review} reviewMessage={reviewMessage} saving={savingReview} setPhotos={setPhotos} setReview={setReview} submit={submitReview} /> : null}
          </div>

          <aside className="grid content-start gap-4">
            <section className="border border-[#0d5962]/12 bg-[#073c44] p-5 text-white"><MapPin aria-hidden className="h-5 w-5 text-[#f0c56b]" /><h2 className="mt-4 font-serif text-2xl font-semibold">Check in at this place</h2><p className="mt-2 text-sm leading-6 text-white/72">Location is requested only when you tap the button. You must be within 150 m to verify a visit.</p><button type="button" disabled={checkingIn} onClick={checkIn} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#f0c56b] px-4 text-sm font-bold text-[#173b3f] transition hover:bg-[#e3b252] disabled:cursor-wait disabled:opacity-60"><LocateFixed aria-hidden className="h-4 w-4" />{checkingIn ? "Checking location…" : detail.visited ? "Check in again" : "Check in"}</button>{checkinMessage ? <p className="mt-3 text-xs leading-5 text-white/78">{checkinMessage}</p> : null}{detail.latestVisit ? <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#bfe5d5]"><CheckCircle2 aria-hidden className="h-4 w-4" /> Last visit: {formatJejuDate(detail.latestVisit.visitedAt)}</p> : null}</section>
            <PlaceFacts place={detail.place} />
          </aside>
        </div>
      ) : null}
    </JejuShell>
  );
}

function PlaceFacts({ place }: { place: JejuPlace }) {
  return <section className="border border-[#0d5962]/12 bg-white/78 p-5"><h2 className="font-serif text-xl font-semibold text-[#073c44]">What to know</h2><dl className="mt-4 grid gap-3 text-sm"><Fact label="Address" value={place.address || "To be confirmed"} /><Fact label="Price" value={place.priceRange === "unknown" ? "To be confirmed" : place.priceRange} /><Fact label="Atmosphere" value={place.atmosphere || "To be confirmed"} /><Fact label="Recommended" value={place.recommendedMenu.join(", ") || "To be confirmed"} /><Fact label="Food features" value={place.foodFeatures.join(", ") || "To be confirmed"} /><Fact label="Allergy information" value={place.allergyInfo || "Ask the venue directly before ordering."} /><Fact label="Dietary support" value={[place.vegetarianSupported ? "Vegetarian" : "", place.veganSupported ? "Vegan" : ""].filter(Boolean).join(" · ") || "Not confirmed"} /><Fact label="English friendly" value={place.englishFriendly ? "Reported by the Jeju Explorer community" : "Not confirmed"} /></dl></section>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase text-[#567578]">{label}</dt><dd className="mt-1 leading-6 text-[#234e53]">{value}</dd></div>;
}

function ReviewCard({ review }: { review: JejuReview }) {
  return <article className="border border-[#0d5962]/10 bg-[#f8fcfa] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-[#073c44]">{review.displayName}</p><time className="mt-0.5 block text-xs text-[#4c6769]">{formatJejuDate(review.createdAt)}</time></div><span className="inline-flex items-center gap-1 text-sm font-bold text-[#a66e1d]"><Star aria-hidden className="h-4 w-4 fill-current" />{review.overallRating}</span></div>{review.reviewText ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#315b5f]">{review.reviewText}</p> : null}{review.whatLiked ? <p className="mt-2 text-sm leading-6 text-[#315b5f]"><strong>Liked: </strong>{review.whatLiked}</p> : null}{review.photos.length > 0 ? <div className="mt-3 grid grid-cols-3 gap-2">{review.photos.map((photo) => <img key={photo.id} src={photo.publicUrl} alt="Jeju Explorer review" className="aspect-square w-full object-cover" />)}</div> : null}</article>;
}

function ReviewForm({ detail, ownReview, photos, review, reviewMessage, saving, setPhotos, setReview, submit }: { detail: DetailResponse; ownReview: JejuReview | null; photos: File[]; review: ReturnType<typeof emptyReview>; reviewMessage: string; saving: boolean; setPhotos: (files: File[]) => void; setReview: (value: ReturnType<typeof emptyReview>) => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  const isFoodPlace = detail.place.category === "restaurant" || detail.place.category === "cafe";
  return <section className="border border-[#0d5962]/12 bg-white/86 p-4 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase text-[#0d5962]">Verified visit</p><h2 className="mt-1 font-serif text-2xl font-semibold text-[#073c44]">{ownReview ? "Edit your review" : "Write a review"}</h2></div><span className="text-xs text-[#4c6769]">Only checked-in users can submit</span></div><form onSubmit={submit} className="mt-5 grid gap-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Rating label="Overall" value={review.overallRating} onChange={(value) => setReview({ ...review, overallRating: value })} />{isFoodPlace ? <Rating label="Food" value={review.foodRating} onChange={(value) => setReview({ ...review, foodRating: value })} /> : null}<Rating label="Price" value={review.priceRating} onChange={(value) => setReview({ ...review, priceRating: value })} /><Rating label="Atmosphere" value={review.atmosphereRating} onChange={(value) => setReview({ ...review, atmosphereRating: value })} /></div><TextArea label="What did you like?" value={review.whatLiked} onChange={(value) => setReview({ ...review, whatLiked: value })} /><TextArea label="What could be better?" value={review.couldBeBetter} onChange={(value) => setReview({ ...review, couldBeBetter: value })} /><TextArea label="Your review" value={review.reviewText} onChange={(value) => setReview({ ...review, reviewText: value })} required /><label className="inline-flex items-center gap-2 text-sm text-[#315b5f]"><input type="checkbox" checked={review.wouldRecommend} onChange={(event) => setReview({ ...review, wouldRecommend: event.target.checked })} className="h-4 w-4 accent-[#0d5962]" />I would recommend this place to another international student.</label><PhotoPicker files={photos} setFiles={setPhotos} /><div className="flex flex-wrap items-center gap-3"><button disabled={saving} type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#0d5962] px-5 text-sm font-bold text-white transition hover:bg-[#073c44] disabled:cursor-wait disabled:opacity-60"><Send aria-hidden className="h-4 w-4" />{saving ? "Saving…" : "Save review"}</button>{reviewMessage ? <p className="text-sm text-[#315b5f]">{reviewMessage}</p> : null}</div></form></section>;
}

function Rating({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return <label className="block border border-[#0d5962]/14 bg-[#f8fcfa] px-3 py-2"><span className="block text-xs font-bold uppercase text-[#567578]">{label}</span><select value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full bg-transparent text-sm font-semibold text-[#073c44] outline-none">{[5, 4, 3, 2, 1].map((item) => <option key={item} value={item}>{item} / 5</option>)}</select></label>;
}

function TextArea({ label, onChange, required = false, value }: { label: string; onChange: (value: string) => void; required?: boolean; value: string }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-[#234e53]">{label}</span><textarea required={required} value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full border border-[#0d5962]/20 bg-white px-3 py-2 text-sm leading-6 text-[#073c44] outline-none transition focus:border-[#0d5962]" /></label>;
}

function PhotoPicker({ files, setFiles }: { files: File[]; setFiles: (files: File[]) => void }) {
  function change(event: ChangeEvent<HTMLInputElement>) { setFiles([...files, ...Array.from(event.target.files ?? [])].slice(0, 5)); event.target.value = ""; }
  return <div><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-dashed border-[#0d5962]/34 bg-[#eaf4ef] px-3 text-sm font-bold text-[#0d5962]"><Upload aria-hidden className="h-4 w-4" />Add up to 5 photos<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={change} /></label>{files.length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{files.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-1.5 bg-[#edf6f2] px-2 py-1 text-xs text-[#315b5f]"><span className="max-w-40 truncate">{file.name}</span><button type="button" onClick={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}><X aria-hidden className="h-3.5 w-3.5" /></button></span>)}</div> : null}</div>;
}

async function uploadReviewPhoto(source: File): Promise<UploadedPhoto> {
  const file = await compressImage(source);
  const data = new FormData();
  data.set("file", file);
  data.set("scope", "reviews");
  const response = await fetch("/api/jeju/uploads", { body: data, method: "POST" });
  const payload = (await response.json().catch(() => ({}))) as UploadedPhoto & { error?: string };
  if (!response.ok || !payload.publicUrl || !payload.storagePath) throw new Error(payload.error || "A review photo could not upload.");
  return { publicUrl: payload.publicUrl, storagePath: payload.storagePath };
}

async function compressImage(file: File) {
  if (file.type === "image/gif" || file.size <= 1_200_000 || typeof window === "undefined") return file;
  try {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Image could not load.")); image.src = objectUrl; });
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
  } catch { return file; }
}
