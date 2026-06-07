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

export type ProjectItem = {
  id: string;
  slug: string;
  title: string;
  englishTitle: string;
  teamOrAuthor: string;
  category: string;
  location: string;
  shortDescription: string;
  fullDescription: string;
  image: ImageAsset;
  tags: string[];
  date: string;
};

export type ActivityPost = {
  id: string;
  slug: string;
  title: string;
  category: "News" | "Activity Log" | "Review" | "Field Note" | "Free Board";
  author: string;
  date: string;
  excerpt: string;
  content: string;
  image: ImageAsset;
  tags: string[];
};

export type FreeBoardId = "ecc" | "hanhwal";

export type FreeBoard = {
  id: FreeBoardId;
  slug: string;
  label: string;
  title: string;
  koreanTitle: string;
  description: string;
  storageKey: string;
};

export type FreeBoardPost = {
  id: string;
  boardId: FreeBoardId;
  title: string;
  author: string;
  content: string;
  createdAt: string;
  imageDataUrl?: string;
  imageName?: string;
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
