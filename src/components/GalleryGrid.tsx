import Image from "next/image";
import type { ImageAsset } from "@/types";

type GalleryGridProps = {
  images?: ImageAsset[];
  placeholders?: string[];
};

export function GalleryGrid({ images = [], placeholders = [] }: GalleryGridProps) {
  const cells = images.length > 0 ? images : placeholders.map((label) => ({ src: "", alt: label }));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cells.map((item, index) => (
        <div key={`${item.alt}-${index}`} className="relative aspect-[4/3] overflow-hidden bg-hanji">
          {item.src ? (
            <Image src={item.src} alt={item.alt} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
          ) : (
            <div className="flex h-full items-end p-5">
              <span className="text-sm font-semibold text-ink/62">{item.alt}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
