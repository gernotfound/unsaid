export type ProductStatus = "idea" | "designing" | "rendering" | "ready" | "published" | "archived";
export type ReviewStatus = "pending" | "approved" | "needs_review" | "rejected";
export type ContentRating = "general" | "18+" | "sensitive";
export type ProductView = "front" | "back" | "detail" | "lifestyle";
export type Language = "it" | "en" | "mixed";

export interface Phrase {
  id: string;
  frontText: string;
  backText?: string;
  language: Language;
  contentRating: ContentRating;
  reviewStatus: ReviewStatus;
  tags: readonly string[];
}

export interface ProductAsset {
  id: string;
  view: ProductView;
  url: string;
  width: number;
  height: number;
  mimeType: "image/webp" | "image/avif" | "image/jpeg" | "image/png";
  approved: boolean;
}

export interface Product {
  id: string;
  slug: string;
  phraseId: string;
  status: ProductStatus;
  priceCents: number;
  currency: "EUR";
  fit: "oversize" | "regular";
  publishedAt?: string;
  assets: readonly ProductAsset[];
}

export interface Variant {
  id: string;
  productId: string;
  sku: string;
  color: string;
  size: "XS" | "S" | "M" | "L" | "XL" | "XXL";
  stockOnHand: number;
  active: boolean;
}
