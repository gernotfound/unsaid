import type {
  MediaDerivativeKind,
  ProductGeneratedMediaManifest,
  ProductRenderSpec,
} from "@unsaid/domain";
import archiveSeed from "../../../data/catalog/archive.json";

export type CatalogStatus = "draft" | "review" | "render_ready" | "published" | "archived";
export type CatalogAudience = "general" | "18+" | "sensitive";
export type CatalogLanguage = "it" | "en" | "mixed";
export type CatalogView = "front" | "back";
export type RenderState = "pending" | "ready" | "approved";

export interface CatalogMedia {
  asset: string | null;
  state: RenderState;
  isBlankBase: boolean;
}

export interface CatalogRecord {
  id: string;
  sequence: number;
  slug: string;
  title: string;
  copy: {
    front: string | null;
    back: string | null;
  };
  language: CatalogLanguage;
  category: string;
  audience: CatalogAudience;
  status: CatalogStatus;
  primaryView: CatalogView;
  priceCents: number | null;
  garment: {
    fit: string;
    color: string;
  };
  /** Legacy approved media. Kept as a fallback while products migrate to generatedMedia. */
  media: {
    front: CatalogMedia;
    back: CatalogMedia;
  };
  /** Private render recipe. It is excluded from the publicCatalog projection. */
  render?: ProductRenderSpec;
  /** Public, immutable output manifest produced by the media pipeline. */
  generatedMedia?: ProductGeneratedMediaManifest;
  notes: string;
  revision: number;
  createdAt?: string;
  updatedAt?: string;
}

export type PublicCatalogRecord = Omit<CatalogRecord, "notes" | "revision" | "render">;

export const ARCHIVE: readonly CatalogRecord[] = (archiveSeed as unknown as readonly CatalogRecord[])
  .slice()
  .sort((a, b) => a.sequence - b.sequence);

export const PUBLIC_ARCHIVE = ARCHIVE.filter((record) => record.status === "published");
export const READY_PRODUCTS = PUBLIC_ARCHIVE.filter((record) => hasApprovedMedia(record));

export function hasApprovedMedia(record: Pick<CatalogRecord, "media" | "generatedMedia">) {
  if (record.generatedMedia?.sides.front.master.url && record.generatedMedia.sides.back.master.url) return true;
  return Boolean(
    record.media.front.asset &&
      record.media.back.asset &&
      record.media.front.state === "approved" &&
      record.media.back.state === "approved",
  );
}

export function assetForView(
  record: Pick<CatalogRecord, "media" | "generatedMedia">,
  view: CatalogView,
  purpose: MediaDerivativeKind = "detail",
) {
  const generated = record.generatedMedia?.sides[view];
  return generated?.derivatives[purpose]?.url ?? generated?.master.url ?? record.media[view].asset;
}

export function primaryAsset(
  record: Pick<CatalogRecord, "primaryView" | "media" | "generatedMedia">,
  purpose: MediaDerivativeKind = "card",
) {
  const fallbackView: CatalogView = record.primaryView === "front" ? "back" : "front";
  return assetForView(record, record.primaryView, purpose) ?? assetForView(record, fallbackView, purpose);
}

export function primaryCopy(record: Pick<CatalogRecord, "primaryView" | "copy" | "title">) {
  return record.copy[record.primaryView] ?? record.copy.front ?? record.copy.back ?? record.title;
}

export function toPublicRecord(record: CatalogRecord): PublicCatalogRecord {
  const { notes: _notes, revision: _revision, render: _render, ...publicRecord } = record;
  return publicRecord;
}

export function findPublicProductBySlug(slug: string) {
  return PUBLIC_ARCHIVE.find((record) => record.slug === slug);
}

export function archiveStats() {
  return {
    total: ARCHIVE.length,
    public: PUBLIC_ARCHIVE.length,
    ready: ARCHIVE.filter((record) => record.status === "published" || record.status === "render_ready").length,
    concepts: ARCHIVE.filter((record) => record.status === "draft").length,
    review: ARCHIVE.filter((record) => record.status === "review").length,
    adult: ARCHIVE.filter((record) => record.audience === "18+").length,
    sensitive: ARCHIVE.filter((record) => record.audience === "sensitive").length,
  } as const;
}
