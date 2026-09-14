import type { CatalogRecord } from "@unsaid/catalog";
import {
  availableInventory,
  commerceSku,
  commerceVariantId,
  validateCommerceConfiguration,
  type CommerceConfigurationInput,
  type InventoryRepository,
  type InventoryReservation,
  type InventorySnapshot,
  type Order,
  type OrderRepository,
  type OrderStatus,
  type SellableProduct,
  type SellableProductRepository,
  type SellableVariant,
} from "@unsaid/domain";
import { getAdminFirestore } from "./firebase";

export const SELLABLE_PRODUCTS_COLLECTION = "sellableProducts";
export const VARIANTS_COLLECTION = "variants";
export const INVENTORY_COLLECTION = "inventory";
export const INVENTORY_RESERVATIONS_COLLECTION = "inventoryReservations";
export const COMMERCE_ORDERS_COLLECTION = "orders";

export interface AdminCommerceVariantState {
  variant: SellableVariant;
  inventory: InventorySnapshot;
}

export interface AdminCommerceItem {
  catalog: Pick<CatalogRecord, "id" | "sequence" | "slug" | "title" | "status" | "garment" | "media">;
  sellable: SellableProduct | null;
  variants: readonly AdminCommerceVariantState[];
}

export interface AdminCommercePage {
  items: readonly AdminCommerceItem[];
  nextCursor: number | null;
}

function now() {
  return new Date().toISOString();
}

function reservationId(orderId: string, variantId: string) {
  return `${orderId}__${variantId}`;
}

function positiveQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    throw new Error("INVALID_QUANTITY");
  }
  return quantity;
}

function catalogSummary(record: CatalogRecord): AdminCommerceItem["catalog"] {
  return {
    id: record.id,
    sequence: record.sequence,
    slug: record.slug,
    title: record.title,
    status: record.status,
    garment: record.garment,
    media: record.media,
  };
}

export async function listAdminCommercePage(options: { afterSequence?: number; limit?: number } = {}): Promise<AdminCommercePage> {
  const db = getAdminFirestore();
  const pageSize = Math.min(25, Math.max(1, Math.trunc(options.limit ?? 25)));
  const baseQuery = db.collection("catalog").orderBy("sequence", "desc").limit(pageSize + 1);
  const query = options.afterSequence == null ? baseQuery : baseQuery.startAfter(options.afterSequence);
  const snapshot = await query.get();
  const hasMore = snapshot.docs.length > pageSize;
  const pageDocs = snapshot.docs.slice(0, pageSize);
  const records = pageDocs.map((document) => document.data() as CatalogRecord);
  const ids = records.map((record) => record.id);

  if (!ids.length) return { items: [], nextCursor: null };

  const productSnapshots = await db.getAll(
    ...ids.map((id) => db.collection(SELLABLE_PRODUCTS_COLLECTION).doc(id)),
  );
  const products = new Map<string, SellableProduct>();
  for (const productSnapshot of productSnapshots) {
    if (productSnapshot.exists) products.set(productSnapshot.id, productSnapshot.data() as SellableProduct);
  }

  const variantSnapshot = await db.collection(VARIANTS_COLLECTION).where("catalogId", "in", ids).get();
  const variants = variantSnapshot.docs.map((document) => document.data() as SellableVariant);
  const inventorySnapshots = variants.length
    ? await db.getAll(...variants.map((variant) => db.collection(INVENTORY_COLLECTION).doc(variant.id)))
    : [];
  const inventory = new Map<string, InventorySnapshot>();
  for (const inventorySnapshot of inventorySnapshots) {
    if (inventorySnapshot.exists) inventory.set(inventorySnapshot.id, inventorySnapshot.data() as InventorySnapshot);
  }

  const variantsByCatalog = new Map<string, AdminCommerceVariantState[]>();
  for (const variant of variants) {
    const state: AdminCommerceVariantState = {
      variant,
      inventory: inventory.get(variant.id) ?? {
        variantId: variant.id,
        onHand: 0,
        reserved: 0,
        updatedAt: "",
      },
    };
    const current = variantsByCatalog.get(variant.catalogId) ?? [];
    current.push(state);
    variantsByCatalog.set(variant.catalogId, current);
  }

  const items = records.map((record) => ({
    catalog: catalogSummary(record),
    sellable: products.get(record.id) ?? null,
    variants: (variantsByCatalog.get(record.id) ?? []).sort((a, b) => a.variant.sku.localeCompare(b.variant.sku)),
  }));

  return {
    items,
    nextCursor: hasMore ? records.at(-1)?.sequence ?? null : null,
  };
}

export async function saveAdminCommerceConfiguration(input: CommerceConfigurationInput) {
  const problems = validateCommerceConfiguration(input);
  if (problems.length) throw new Error(problems.join(","));

  const db = getAdminFirestore();
  const timestamp = now();
  const catalogRef = db.collection("catalog").doc(input.catalogId);
  const sellableRef = db.collection(SELLABLE_PRODUCTS_COLLECTION).doc(input.catalogId);
  const variantQuery = db.collection(VARIANTS_COLLECTION).where("catalogId", "==", input.catalogId);

  await db.runTransaction(async (transaction) => {
    const catalogSnapshot = await transaction.get(catalogRef);
    if (!catalogSnapshot.exists) throw new Error("CATALOG_NOT_FOUND");
    const catalog = catalogSnapshot.data() as CatalogRecord;

    if (input.active) {
      if (catalog.status !== "published") throw new Error("CATALOG_NOT_PUBLISHED");
      const mediaReady = catalog.media.front.state === "approved" && catalog.media.back.state === "approved";
      if (!mediaReady || !catalog.media.front.asset || !catalog.media.back.asset) {
        throw new Error("CATALOG_MEDIA_NOT_READY");
      }
    }

    const existingVariants = await transaction.get(variantQuery);
    const desired = input.variants.map((configuration) => {
      const id = commerceVariantId(input.catalogId, input.garmentColor, configuration.size);
      return {
        configuration,
        id,
        variantRef: db.collection(VARIANTS_COLLECTION).doc(id),
        inventoryRef: db.collection(INVENTORY_COLLECTION).doc(id),
      };
    });

    const inventorySnapshots = await Promise.all(desired.map((entry) => transaction.get(entry.inventoryRef)));
    const desiredIds = new Set(desired.map((entry) => entry.id));

    for (let index = 0; index < desired.length; index += 1) {
      const entry = desired[index]!;
      const inventorySnapshot = inventorySnapshots[index]!;
      const existingInventory = inventorySnapshot.exists
        ? (inventorySnapshot.data() as InventorySnapshot)
        : null;
      const reserved = existingInventory?.reserved ?? 0;
      if (entry.configuration.onHand < reserved) {
        throw new Error(`STOCK_BELOW_RESERVED:${entry.configuration.size}`);
      }
    }

    const product: SellableProduct = {
      catalogId: input.catalogId,
      active: input.active,
      price: { amountCents: input.priceCents, currency: "EUR" },
      taxClass: input.taxClass.trim(),
      garmentColor: input.garmentColor,
      updatedAt: timestamp,
    };
    transaction.set(sellableRef, product);

    for (const entry of desired) {
      const variant: SellableVariant = {
        id: entry.id,
        catalogId: input.catalogId,
        sku: commerceSku(input.catalogId, input.garmentColor, entry.configuration.size),
        size: entry.configuration.size,
        garmentColor: input.garmentColor,
        active: entry.configuration.active,
      };
      transaction.set(entry.variantRef, variant);

      const inventorySnapshot = inventorySnapshots[desired.findIndex((candidate) => candidate.id === entry.id)]!;
      const existingInventory = inventorySnapshot.exists
        ? (inventorySnapshot.data() as InventorySnapshot)
        : null;
      transaction.set(entry.inventoryRef, {
        variantId: entry.id,
        onHand: entry.configuration.onHand,
        reserved: existingInventory?.reserved ?? 0,
        updatedAt: timestamp,
      } satisfies InventorySnapshot);
    }

    for (const document of existingVariants.docs) {
      if (desiredIds.has(document.id)) continue;
      const previous = document.data() as SellableVariant;
      if (previous.active) transaction.set(document.ref, { ...previous, active: false });
    }
  });
}

export class FirestoreSellableProductRepository implements SellableProductRepository {
  async getProduct(catalogId: string): Promise<SellableProduct | null> {
    const snapshot = await getAdminFirestore().collection(SELLABLE_PRODUCTS_COLLECTION).doc(catalogId).get();
    return snapshot.exists ? (snapshot.data() as SellableProduct) : null;
  }

  async listVariants(catalogId: string): Promise<readonly SellableVariant[]> {
    const snapshot = await getAdminFirestore()
      .collection(VARIANTS_COLLECTION)
      .where("catalogId", "==", catalogId)
      .get();

    return snapshot.docs
      .map((item) => item.data() as SellableVariant)
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }
}

export class FirestoreInventoryRepository implements InventoryRepository {
  async getAvailability(variantId: string): Promise<InventorySnapshot | null> {
    const snapshot = await getAdminFirestore().collection(INVENTORY_COLLECTION).doc(variantId).get();
    return snapshot.exists ? (snapshot.data() as InventorySnapshot) : null;
  }

  async reserve(input: { variantId: string; quantity: number; orderId: string }): Promise<void> {
    const quantity = positiveQuantity(input.quantity);
    const db = getAdminFirestore();
    const inventoryRef = db.collection(INVENTORY_COLLECTION).doc(input.variantId);
    const reservationRef = db
      .collection(INVENTORY_RESERVATIONS_COLLECTION)
      .doc(reservationId(input.orderId, input.variantId));

    await db.runTransaction(async (transaction) => {
      const [inventorySnapshot, reservationSnapshot] = await Promise.all([
        transaction.get(inventoryRef),
        transaction.get(reservationRef),
      ]);

      if (!inventorySnapshot.exists) throw new Error("INVENTORY_NOT_FOUND");
      const inventory = inventorySnapshot.data() as InventorySnapshot;
      const existing = reservationSnapshot.exists
        ? (reservationSnapshot.data() as InventoryReservation)
        : null;

      if (existing?.status === "active") {
        if (existing.quantity === quantity) return;
        throw new Error("RESERVATION_CONFLICT");
      }
      if (existing?.status === "committed") throw new Error("RESERVATION_ALREADY_COMMITTED");
      if (availableInventory(inventory) < quantity) throw new Error("OUT_OF_STOCK");

      const timestamp = now();
      transaction.set(inventoryRef, {
        ...inventory,
        reserved: inventory.reserved + quantity,
        updatedAt: timestamp,
      } satisfies InventorySnapshot);

      transaction.set(reservationRef, {
        id: reservationRef.id,
        orderId: input.orderId,
        variantId: input.variantId,
        quantity,
        status: "active",
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      } satisfies InventoryReservation);
    });
  }

  async release(input: { variantId: string; quantity: number; orderId: string }): Promise<void> {
    const quantity = positiveQuantity(input.quantity);
    const db = getAdminFirestore();
    const inventoryRef = db.collection(INVENTORY_COLLECTION).doc(input.variantId);
    const reservationRef = db
      .collection(INVENTORY_RESERVATIONS_COLLECTION)
      .doc(reservationId(input.orderId, input.variantId));

    await db.runTransaction(async (transaction) => {
      const [inventorySnapshot, reservationSnapshot] = await Promise.all([
        transaction.get(inventoryRef),
        transaction.get(reservationRef),
      ]);

      if (!inventorySnapshot.exists || !reservationSnapshot.exists) return;
      const inventory = inventorySnapshot.data() as InventorySnapshot;
      const reservation = reservationSnapshot.data() as InventoryReservation;
      if (reservation.status !== "active") return;
      if (reservation.quantity !== quantity) throw new Error("RESERVATION_CONFLICT");

      const timestamp = now();
      transaction.set(inventoryRef, {
        ...inventory,
        reserved: Math.max(0, inventory.reserved - quantity),
        updatedAt: timestamp,
      } satisfies InventorySnapshot);
      transaction.set(reservationRef, {
        ...reservation,
        status: "released",
        updatedAt: timestamp,
      } satisfies InventoryReservation);
    });
  }

  async commit(input: { variantId: string; quantity: number; orderId: string }): Promise<void> {
    const quantity = positiveQuantity(input.quantity);
    const db = getAdminFirestore();
    const inventoryRef = db.collection(INVENTORY_COLLECTION).doc(input.variantId);
    const reservationRef = db
      .collection(INVENTORY_RESERVATIONS_COLLECTION)
      .doc(reservationId(input.orderId, input.variantId));

    await db.runTransaction(async (transaction) => {
      const [inventorySnapshot, reservationSnapshot] = await Promise.all([
        transaction.get(inventoryRef),
        transaction.get(reservationRef),
      ]);

      if (!inventorySnapshot.exists || !reservationSnapshot.exists) {
        throw new Error("RESERVATION_NOT_FOUND");
      }

      const inventory = inventorySnapshot.data() as InventorySnapshot;
      const reservation = reservationSnapshot.data() as InventoryReservation;
      if (reservation.status === "committed") {
        if (reservation.quantity === quantity) return;
        throw new Error("RESERVATION_CONFLICT");
      }
      if (reservation.status !== "active" || reservation.quantity !== quantity) {
        throw new Error("RESERVATION_CONFLICT");
      }
      if (inventory.onHand < quantity) throw new Error("INVENTORY_CORRUPT");

      const timestamp = now();
      transaction.set(inventoryRef, {
        ...inventory,
        onHand: inventory.onHand - quantity,
        reserved: Math.max(0, inventory.reserved - quantity),
        updatedAt: timestamp,
      } satisfies InventorySnapshot);
      transaction.set(reservationRef, {
        ...reservation,
        status: "committed",
        updatedAt: timestamp,
      } satisfies InventoryReservation);
    });
  }
}

export class FirestoreOrderRepository implements OrderRepository {
  async getById(orderId: string): Promise<Order | null> {
    const snapshot = await getAdminFirestore().collection(COMMERCE_ORDERS_COLLECTION).doc(orderId).get();
    return snapshot.exists ? (snapshot.data() as Order) : null;
  }

  async listByCustomer(customerId: string, maximum = 25): Promise<readonly Order[]> {
    const limit = Math.min(50, Math.max(1, Math.trunc(maximum)));
    const snapshot = await getAdminFirestore()
      .collection(COMMERCE_ORDERS_COLLECTION)
      .where("customerId", "==", customerId)
      .limit(limit)
      .get();

    return snapshot.docs
      .map((item) => item.data() as Order)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(order: Order): Promise<void> {
    await getAdminFirestore().collection(COMMERCE_ORDERS_COLLECTION).doc(order.id).create(order);
  }

  async updateStatus(orderId: string, status: OrderStatus): Promise<void> {
    const ref = getAdminFirestore().collection(COMMERCE_ORDERS_COLLECTION).doc(orderId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error("ORDER_NOT_FOUND");
    await ref.update({ status, updatedAt: now() });
  }
}
