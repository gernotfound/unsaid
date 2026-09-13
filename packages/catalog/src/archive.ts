import archiveSeed from "../../../data/catalog/archive.json";

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

export const ARCHIVE: readonly CatalogRecord[] = archiveSeed as unknown as readonly CatalogRecord[];

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
