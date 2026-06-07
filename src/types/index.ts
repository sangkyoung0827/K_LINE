export type ImageAsset = {
  src: string;
  alt: string;
};

export type GoodsItem = {
  id: string;
  slug: string;
  name: string;
  koreanName: string;
  shortDescription: string;
  fullDescription: string;
  story: string;
  pricePlaceholder: string;
  estimatedPriceEur: number;
  dimensions: string;
  materials: string[];
  useCases: string[];
  category: string;
  images: ImageAsset[];
  specifications: Record<string, string>;
};

export type ClassItem = {
  id: string;
  slug: string;
  title: string;
  koreanTitle: string;
  description: string;
  targetParticipants: string[];
  durationPlaceholder: string;
  pricePlaceholder: string;
  includedItems: string[];
};

export type CartLine = {
  id: string;
  slug: string;
  name: string;
  koreanName: string;
  pricePlaceholder: string;
  estimatedPriceEur: number;
  image: ImageAsset;
  quantity: number;
};
