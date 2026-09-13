import chunk0001 from "../../../data/catalog/0001-0020.json";
import chunk0021 from "../../../data/catalog/0021-0040.json";
import chunk0041 from "../../../data/catalog/0041-0060.json";
import chunk0061 from "../../../data/catalog/0061-0080.json";
import chunk0081 from "../../../data/catalog/0081-0081.json";

export type ArchiveStatus = "ready" | "concept" | "review";
export type ArchiveAudience = "general" | "18+" | "sensitive" | "review";
export type ArchiveLanguage = "it" | "en" | "mix";

export interface CatalogRecord {
  id: string;
  legacyId: string;
  slug: string;
  title: string;
  phrase: string | null;
  backPhrase: string | null;
  language: ArchiveLanguage;
  category: string;
  audience: ArchiveAudience;
  price: number | null;
  status: ArchiveStatus;
  publishable: boolean;
  images: { front: string | null; back: string | null };
  views: readonly string[];
  fit: string;
  color: string;
  notes: string;
}

export const ARCHIVE: readonly CatalogRecord[] = [
  ...(chunk0001 as unknown as CatalogRecord[]),
  ...(chunk0021 as unknown as CatalogRecord[]),
  ...(chunk0041 as unknown as CatalogRecord[]),
  ...(chunk0061 as unknown as CatalogRecord[]),
  ...(chunk0081 as unknown as CatalogRecord[]),
];

export const PUBLIC_ARCHIVE = ARCHIVE.filter((record) => record.publishable);
export const READY_PRODUCTS = PUBLIC_ARCHIVE.filter((record) => record.status === "ready");

export function findPublicProductBySlug(slug: string) {
  return PUBLIC_ARCHIVE.find((record) => record.slug === slug);
}

export function archiveStats() {
  return {
    total: ARCHIVE.length,
    public: PUBLIC_ARCHIVE.length,
    ready: ARCHIVE.filter((record) => record.status === "ready").length,
    concepts: ARCHIVE.filter((record) => record.status === "concept").length,
    review: ARCHIVE.filter((record) => record.status === "review").length,
    adult: ARCHIVE.filter((record) => record.audience === "18+").length,
  } as const;
}
