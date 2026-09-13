import {
  PUBLIC_ARCHIVE,
  archiveStats,
  findPublicProductBySlug,
  type CatalogRecord,
} from "@unsaid/catalog";
import { getAdminFirestore, isFirebaseConfigured } from "./firebase";

export const CATALOG_COLLECTION = "catalog";
export const CATALOG_STATS_DOCUMENT = "meta/catalogStats";

export interface CatalogStats {
  total: number;
  public: number;
  ready: number;
  concepts: number;
  review: number;
  adult: number;
}

function useFirebase() {
  return process.env.CATALOG_SOURCE === "firebase" && isFirebaseConfigured();
}

function sortById(records: CatalogRecord[]) {
  return records.sort((a, b) => a.id.localeCompare(b.id));
}

export async function listPublicCatalog(): Promise<readonly CatalogRecord[]> {
  if (!useFirebase()) return PUBLIC_ARCHIVE;

  const snapshot = await getAdminFirestore()
    .collection(CATALOG_COLLECTION)
    .where("publishable", "==", true)
    .get();

  return sortById(snapshot.docs.map((doc) => doc.data() as CatalogRecord));
}

export async function getPublicProductBySlug(slug: string): Promise<CatalogRecord | undefined> {
  if (!useFirebase()) return findPublicProductBySlug(slug);

  const snapshot = await getAdminFirestore()
    .collection(CATALOG_COLLECTION)
    .where("slug", "==", slug)
    .where("publishable", "==", true)
    .limit(1)
    .get();

  return snapshot.empty ? undefined : (snapshot.docs[0]!.data() as CatalogRecord);
}

export async function getCatalogStats(): Promise<CatalogStats> {
  if (!useFirebase()) return archiveStats();

  const snapshot = await getAdminFirestore().doc(CATALOG_STATS_DOCUMENT).get();
  if (snapshot.exists) return snapshot.data() as CatalogStats;

  // Safe fallback while the stats document is not seeded yet.
  const publicRecords = await listPublicCatalog();
  return {
    total: publicRecords.length,
    public: publicRecords.length,
    ready: publicRecords.filter((record) => record.status === "ready").length,
    concepts: publicRecords.filter((record) => record.status === "concept").length,
    review: publicRecords.filter((record) => record.status === "review").length,
    adult: publicRecords.filter((record) => record.audience === "18+").length,
  };
}

export function catalogSource() {
  return useFirebase() ? "firebase" : "local";
}
