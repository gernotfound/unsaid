import {
  PUBLIC_ARCHIVE,
  archiveStats,
  findPublicProductBySlug,
  type CatalogPage,
  type CatalogQuery,
  type CatalogRecord,
  type CatalogSort,
  type CatalogStats,
} from "@unsaid/catalog";
import { getAdminFirestore, isFirebaseConfigured } from "./firebase";

export type { CatalogStats } from "@unsaid/catalog";

export const CATALOG_COLLECTION = "catalog";
export const PUBLIC_CATALOG_COLLECTION = "publicCatalog";
export const CATALOG_META_DOCUMENT = "meta/catalog";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;

function useFirebase() {
  return process.env.CATALOG_SOURCE === "firebase" && isFirebaseConfigured();
}

function pageSize(value?: number) {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(value!)));
}

function sortDirection(sort: CatalogSort = "newest") {
  return sort === "archive" ? "asc" : "desc";
}

function localPage(query: CatalogQuery = {}): CatalogPage<CatalogRecord> {
  const limit = pageSize(query.limit);
  const direction = sortDirection(query.sort);
  let records = [...PUBLIC_ARCHIVE].sort((a, b) =>
    direction === "desc" ? b.sequence - a.sequence : a.sequence - b.sequence,
  );

  if (query.cursor != null) {
    records = records.filter((record) =>
      direction === "desc" ? record.sequence < query.cursor! : record.sequence > query.cursor!,
    );
  }

  const window = records.slice(0, limit + 1);
  const items = window.slice(0, limit);
  return {
    items,
    nextCursor: window.length > limit ? items.at(-1)?.sequence : undefined,
  };
}

/**
 * Bounded public catalog reader for storefront pages.
 * The browser receives one page instead of the whole archive.
 */
export async function listPublicCatalogPage(query: CatalogQuery = {}): Promise<CatalogPage<CatalogRecord>> {
  if (!useFirebase()) return localPage(query);

  const limit = pageSize(query.limit);
  const direction = sortDirection(query.sort);
  let ref = getAdminFirestore()
    .collection(PUBLIC_CATALOG_COLLECTION)
    .orderBy("sequence", direction)
    .limit(limit + 1);

  if (query.cursor != null) ref = ref.startAfter(query.cursor);

  const snapshot = await ref.get();
  const window = snapshot.docs.map((item) => item.data() as CatalogRecord);
  const items = window.slice(0, limit);

  return {
    items,
    nextCursor: window.length > limit ? items.at(-1)?.sequence : undefined,
  };
}

/**
 * Dedicated bounded query for the homepage hero/latest feature.
 * Avoids a full publicCatalog scan just to select one record.
 */
export async function getFeaturedPublicProduct(): Promise<CatalogRecord | undefined> {
  if (!useFirebase()) return [...PUBLIC_ARCHIVE].sort((a, b) => b.sequence - a.sequence)[0];

  const snapshot = await getAdminFirestore()
    .collection(PUBLIC_CATALOG_COLLECTION)
    .orderBy("sequence", "desc")
    .limit(1)
    .get();

  return snapshot.empty ? undefined : (snapshot.docs[0]!.data() as CatalogRecord);
}

/**
 * Full list remains available for trusted tooling/backwards compatibility.
 * Storefront routes should prefer listPublicCatalogPage().
 */
export async function listPublicCatalog(): Promise<readonly CatalogRecord[]> {
  if (!useFirebase()) return PUBLIC_ARCHIVE;

  const snapshot = await getAdminFirestore()
    .collection(PUBLIC_CATALOG_COLLECTION)
    .orderBy("sequence", "asc")
    .get();

  return snapshot.docs.map((item) => item.data() as CatalogRecord);
}

export async function getPublicProductBySlug(slug: string): Promise<CatalogRecord | undefined> {
  if (!useFirebase()) return findPublicProductBySlug(slug);

  const snapshot = await getAdminFirestore()
    .collection(PUBLIC_CATALOG_COLLECTION)
    .where("slug", "==", slug)
    .limit(1)
    .get();

  return snapshot.empty ? undefined : (snapshot.docs[0]!.data() as CatalogRecord);
}

export async function getCatalogStats(): Promise<CatalogStats> {
  if (!useFirebase()) return archiveStats();

  const snapshot = await getAdminFirestore().doc(CATALOG_META_DOCUMENT).get();
  if (snapshot.exists) {
    const data = snapshot.data() as Partial<CatalogStats>;
    return {
      total: data.total ?? 0,
      public: data.public ?? 0,
      ready: data.ready ?? 0,
      concepts: data.concepts ?? 0,
      review: data.review ?? 0,
      adult: data.adult ?? 0,
      sensitive: data.sensitive ?? 0,
    };
  }

  const aggregate = await getAdminFirestore().collection(PUBLIC_CATALOG_COLLECTION).count().get();
  const publicCount = aggregate.data().count;
  return {
    total: publicCount,
    public: publicCount,
    ready: publicCount,
    concepts: 0,
    review: 0,
    adult: 0,
    sensitive: 0,
  };
}

export function catalogSource() {
  return useFirebase() ? "firebase" : "local";
}
