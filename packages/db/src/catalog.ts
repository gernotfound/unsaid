import {
  PUBLIC_ARCHIVE,
  archiveStats,
  findPublicProductBySlug,
  type CatalogRecord,
} from "@unsaid/catalog";
import { getAdminFirestore, isFirebaseConfigured } from "./firebase";

export const CATALOG_COLLECTION = "catalog";
export const PUBLIC_CATALOG_COLLECTION = "publicCatalog";
export const CATALOG_META_DOCUMENT = "meta/catalog";

export interface CatalogStats {
  total: number;
  public: number;
  ready: number;
  concepts: number;
  review: number;
  adult: number;
  sensitive: number;
}

function useFirebase() {
  return process.env.CATALOG_SOURCE === "firebase" && isFirebaseConfigured();
}

function sortBySequence(records: CatalogRecord[]) {
  return records.sort((a, b) => a.sequence - b.sequence);
}

export async function listPublicCatalog(): Promise<readonly CatalogRecord[]> {
  if (!useFirebase()) return PUBLIC_ARCHIVE;

  const snapshot = await getAdminFirestore()
    .collection(PUBLIC_CATALOG_COLLECTION)
    .orderBy("sequence", "asc")
    .get();

  return sortBySequence(snapshot.docs.map((item) => item.data() as CatalogRecord));
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

  const records = await listPublicCatalog();
  return {
    total: records.length,
    public: records.length,
    ready: records.length,
    concepts: 0,
    review: 0,
    adult: records.filter((record) => record.audience === "18+").length,
    sensitive: records.filter((record) => record.audience === "sensitive").length,
  };
}

export function catalogSource() {
  return useFirebase() ? "firebase" : "local";
}
