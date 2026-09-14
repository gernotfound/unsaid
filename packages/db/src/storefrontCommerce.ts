import type { PublicCatalogRecord } from "@unsaid/catalog";
import {
  GARMENT_SIZES,
  availableInventory,
  type GarmentColor,
  type GarmentSize,
  type InventorySnapshot,
  type Money,
  type SellableProduct,
  type SellableVariant,
} from "@unsaid/domain";
import {
  INVENTORY_COLLECTION,
  SELLABLE_PRODUCTS_COLLECTION,
  VARIANTS_COLLECTION,
} from "./commerce";
import { getAdminFirestore, isFirebaseConfigured } from "./firebase";

const PUBLIC_CATALOG_COLLECTION = "publicCatalog";
const MAX_CART_LINES = 25;
const MAX_LINE_QUANTITY = 20;

export interface PublicCommerceVariant {
  variantId: string;
  sku: string;
  size: GarmentSize;
  garmentColor: GarmentColor;
  available: number;
}

export interface PublicCommerceState {
  catalogId: string;
  price: Money;
  garmentColor: GarmentColor;
  variants: readonly PublicCommerceVariant[];
}

export interface CartValidationInputLine {
  variantId: string;
  quantity: number;
}

export type CartValidationIssueReason =
  | "invalid_line"
  | "variant_unavailable"
  | "product_unavailable"
  | "insufficient_stock";

export interface CartValidationIssue {
  variantId: string;
  reason: CartValidationIssueReason;
  available?: number;
}

export interface ValidatedCartLine {
  variantId: string;
  catalogId: string;
  slug: string;
  title: string;
  size: GarmentSize;
  garmentColor: GarmentColor;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  available: number;
  image: string | null;
}

export interface ValidatedCart {
  lines: readonly ValidatedCartLine[];
  issues: readonly CartValidationIssue[];
  subtotal: Money;
}

function sizeOrder(size: GarmentSize) {
  return GARMENT_SIZES.indexOf(size);
}

function emptyCart(): ValidatedCart {
  return {
    lines: [],
    issues: [],
    subtotal: { amountCents: 0, currency: "EUR" },
  };
}

function normalizeCartLines(lines: readonly CartValidationInputLine[]) {
  if (lines.length > MAX_CART_LINES) throw new Error("CART_TOO_LARGE");

  const normalized = new Map<string, number>();
  const issues: CartValidationIssue[] = [];

  for (const line of lines) {
    const variantId = typeof line.variantId === "string" ? line.variantId.trim() : "";
    const quantity = Number(line.quantity);
    if (!variantId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      issues.push({ variantId: variantId || "unknown", reason: "invalid_line" });
      continue;
    }

    const nextQuantity = (normalized.get(variantId) ?? 0) + quantity;
    if (nextQuantity > MAX_LINE_QUANTITY) {
      issues.push({ variantId, reason: "invalid_line" });
      normalized.delete(variantId);
      continue;
    }
    normalized.set(variantId, nextQuantity);
  }

  return { normalized, issues };
}

export async function getPublicCommerceState(catalogId: string): Promise<PublicCommerceState | null> {
  if (!isFirebaseConfigured()) return null;

  const db = getAdminFirestore();
  const [catalogSnapshot, productSnapshot] = await Promise.all([
    db.collection(PUBLIC_CATALOG_COLLECTION).doc(catalogId).get(),
    db.collection(SELLABLE_PRODUCTS_COLLECTION).doc(catalogId).get(),
  ]);

  if (!catalogSnapshot.exists || !productSnapshot.exists) return null;
  const product = productSnapshot.data() as SellableProduct;
  if (!product.active || product.price.currency !== "EUR" || product.price.amountCents < 1) return null;

  const variantSnapshot = await db
    .collection(VARIANTS_COLLECTION)
    .where("catalogId", "==", catalogId)
    .get();

  const variants = variantSnapshot.docs
    .map((document) => document.data() as SellableVariant)
    .filter((variant) => variant.active && variant.garmentColor === product.garmentColor);

  const inventorySnapshots = variants.length
    ? await db.getAll(...variants.map((variant) => db.collection(INVENTORY_COLLECTION).doc(variant.id)))
    : [];
  const inventory = new Map<string, InventorySnapshot>();
  for (const snapshot of inventorySnapshots) {
    if (snapshot.exists) inventory.set(snapshot.id, snapshot.data() as InventorySnapshot);
  }

  return {
    catalogId,
    price: product.price,
    garmentColor: product.garmentColor,
    variants: variants
      .map((variant) => ({
        variantId: variant.id,
        sku: variant.sku,
        size: variant.size,
        garmentColor: variant.garmentColor,
        available: availableInventory(inventory.get(variant.id) ?? { variantId: variant.id, onHand: 0, reserved: 0, updatedAt: "" }),
      }))
      .sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size)),
  };
}

export async function validatePublicCart(inputLines: readonly CartValidationInputLine[]): Promise<ValidatedCart> {
  if (!isFirebaseConfigured()) return emptyCart();
  const { normalized, issues } = normalizeCartLines(inputLines);
  const variantIds = [...normalized.keys()];
  if (!variantIds.length) return { ...emptyCart(), issues };

  const db = getAdminFirestore();
  const variantSnapshots = await db.getAll(
    ...variantIds.map((variantId) => db.collection(VARIANTS_COLLECTION).doc(variantId)),
  );

  const variants = new Map<string, SellableVariant>();
  for (const snapshot of variantSnapshots) {
    if (snapshot.exists) variants.set(snapshot.id, snapshot.data() as SellableVariant);
  }

  const catalogIds = [...new Set([...variants.values()].map((variant) => variant.catalogId))];
  const [productSnapshots, catalogSnapshots, inventorySnapshots] = await Promise.all([
    catalogIds.length
      ? db.getAll(...catalogIds.map((catalogId) => db.collection(SELLABLE_PRODUCTS_COLLECTION).doc(catalogId)))
      : Promise.resolve([]),
    catalogIds.length
      ? db.getAll(...catalogIds.map((catalogId) => db.collection(PUBLIC_CATALOG_COLLECTION).doc(catalogId)))
      : Promise.resolve([]),
    db.getAll(...variantIds.map((variantId) => db.collection(INVENTORY_COLLECTION).doc(variantId))),
  ]);

  const products = new Map<string, SellableProduct>();
  for (const snapshot of productSnapshots) {
    if (snapshot.exists) products.set(snapshot.id, snapshot.data() as SellableProduct);
  }
  const catalog = new Map<string, PublicCatalogRecord>();
  for (const snapshot of catalogSnapshots) {
    if (snapshot.exists) catalog.set(snapshot.id, snapshot.data() as PublicCatalogRecord);
  }
  const inventory = new Map<string, InventorySnapshot>();
  for (const snapshot of inventorySnapshots) {
    if (snapshot.exists) inventory.set(snapshot.id, snapshot.data() as InventorySnapshot);
  }

  const lines: ValidatedCartLine[] = [];

  for (const variantId of variantIds) {
    const quantity = normalized.get(variantId)!;
    const variant = variants.get(variantId);
    if (!variant || !variant.active) {
      issues.push({ variantId, reason: "variant_unavailable" });
      continue;
    }

    const product = products.get(variant.catalogId);
    const productCatalog = catalog.get(variant.catalogId);
    if (
      !product ||
      !product.active ||
      product.price.currency !== "EUR" ||
      product.price.amountCents < 1 ||
      product.garmentColor !== variant.garmentColor ||
      !productCatalog
    ) {
      issues.push({ variantId, reason: "product_unavailable" });
      continue;
    }

    const stock = inventory.get(variantId) ?? {
      variantId,
      onHand: 0,
      reserved: 0,
      updatedAt: "",
    };
    const available = availableInventory(stock);
    if (available < quantity) {
      issues.push({ variantId, reason: "insufficient_stock", available });
      continue;
    }

    const unitPrice = product.price;
    lines.push({
      variantId,
      catalogId: variant.catalogId,
      slug: productCatalog.slug,
      title: productCatalog.title,
      size: variant.size,
      garmentColor: variant.garmentColor,
      quantity,
      unitPrice,
      lineTotal: { amountCents: unitPrice.amountCents * quantity, currency: "EUR" },
      available,
      image: productCatalog.media.front.asset ?? productCatalog.media.back.asset,
    });
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotal.amountCents, 0);
  return {
    lines,
    issues,
    subtotal: { amountCents: subtotalCents, currency: "EUR" },
  };
}
