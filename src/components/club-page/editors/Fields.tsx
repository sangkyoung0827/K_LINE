"use client";
import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { ClubKey } from "@/types/club-page";
import styles from "../club-page.module.css";

export function Field({
  label,
  value,
  onChange,
  multiline = false,
  limit = 160,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  limit?: number;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          maxLength={limit}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          value={value}
          maxLength={limit}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
export function ImageField({
  clubKey,
  value,
  onChange,
}: {
  clubKey: ClubKey;
  value: string;
  onChange: (value: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  async function upload(file: File | undefined) {
    if (!file) return;
    if (
      file.size > 4_000_000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("4MB 이하 JPEG, PNG, WebP 파일을 선택해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/club-pages/${clubKey}/media`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(45_000),
      });
      const result = await response.json();
      if (!response.ok || typeof result.url !== "string")
        throw new Error(result.error || "이미지를 업로드하지 못했습니다.");
      onChangeRef.current(result.url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "이미지를 업로드하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.imageField}>
      {value && (
        <div className={styles.imageThumb}>
          <img src={value} alt="선택한 이미지" />
          <button
            type="button"
            aria-label="이미지 제거"
            title="이미지 제거"
            onClick={() => onChange("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <label className={styles.upload}>
        <ImagePlus size={18} />
        <span>{busy ? "업로드 중…" : "사진 업로드"}</span>
        <input
          disabled={busy}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      <small>JPEG · PNG · WebP / 4MB</small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
