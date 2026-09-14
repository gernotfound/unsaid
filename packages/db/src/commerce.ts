import {
  availableInventory,
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
      if (reservation.status === "committed") return;
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
