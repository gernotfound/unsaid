import {
  availableInventory,
  type GarmentColor,
  type InventorySnapshot,
  type SellableProduct,
  type SellableVariant,
} from "@unsaid/domain";
import {
  INVENTORY_COLLECTION,
  SELLABLE_PRODUCTS_COLLECTION,
  VARIANTS_COLLECTION,
} from "./commerce";
import { getAdminFirestore, isFirebaseConfigured } from "./firebase";

const CATALOG_ID_PATTERN = /^UNS-\d{4,}$/;

export interface PublicCommerceListSummary {
  catalogId: string;
  priceCents: number;
  garmentColor: GarmentColor;
  available: number;
}

export async function getPublicCommerceSummaries(
  catalogIds: readonly string[],
): Promise<Record<string, PublicCommerceListSummary>> {
  if (!isFirebaseConfigured()) return {};

  const ids = [...new Set(catalogIds.filter((id) => CATALOG_ID_PATTERN.test(id)))].slice(0, 25);
  if (!ids.length) return {};

  const db = getAdminFirestore();
  const productSnapshots = await db.getAll(
    ...ids.map((id) => db.collection(SELLABLE_PRODUCTS_COLLECTION).doc(id)),
  );
  const products = new Map<string, SellableProduct>();
  for (const snapshot of productSnapshots) {
    if (!snapshot.exists) continue;
    const product = snapshot.data() as SellableProduct;
    if (product.active && product.price.currency === "EUR" && product.price.amountCents > 0) {
      products.set(snapshot.id, product);
    }
  }

  const activeIds = [...products.keys()];
  if (!activeIds.length) return {};

  const variantSnapshot = await db
    .collection(VARIANTS_COLLECTION)
    .where("catalogId", "in", activeIds)
    .get();
  const variants = variantSnapshot.docs
    .map((document) => document.data() as SellableVariant)
    .filter((variant) => {
      const product = products.get(variant.catalogId);
      return Boolean(product && variant.active && variant.garmentColor === product.garmentColor);
    });

  const inventorySnapshots = variants.length
    ? await db.getAll(...variants.map((variant) => db.collection(INVENTORY_COLLECTION).doc(variant.id)))
    : [];
  const inventory = new Map<string, InventorySnapshot>();
  for (const snapshot of inventorySnapshots) {
    if (snapshot.exists) inventory.set(snapshot.id, snapshot.data() as InventorySnapshot);
  }

  const availableByCatalog = new Map<string, number>();
  for (const variant of variants) {
    const stock = inventory.get(variant.id) ?? {
      variantId: variant.id,
      onHand: 0,
      reserved: 0,
      updatedAt: "",
    };
    availableByCatalog.set(
      variant.catalogId,
      (availableByCatalog.get(variant.catalogId) ?? 0) + availableInventory(stock),
    );
  }

  return Object.fromEntries(
    activeIds.map((catalogId) => {
      const product = products.get(catalogId)!;
      return [catalogId, {
        catalogId,
        priceCents: product.price.amountCents,
        garmentColor: product.garmentColor,
        available: availableByCatalog.get(catalogId) ?? 0,
      } satisfies PublicCommerceListSummary];
    }),
  );
}
