import {
  normalizeItalianAddress,
  validateItalianAddress,
  type AuthenticatedCustomer,
  type CustomerAddress,
  type CustomerAddressInput,
  type CustomerProfile,
  type Order,
} from "@unsaid/domain";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "./firebase";

export const CUSTOMERS_COLLECTION = "customers";
export const ORDERS_COLLECTION = "orders";
const ADDRESSES_SUBCOLLECTION = "addresses";
const MAX_ADDRESSES = 10;

function now() {
  return new Date().toISOString();
}

function profileRef(uid: string) {
  return getAdminFirestore().collection(CUSTOMERS_COLLECTION).doc(uid);
}

function addressRef(uid: string, addressId: string) {
  return profileRef(uid).collection(ADDRESSES_SUBCOLLECTION).doc(addressId);
}

export async function ensureCustomerProfile(
  identity: AuthenticatedCustomer & { displayName?: string },
): Promise<CustomerProfile> {
  const ref = profileRef(identity.uid);
  const snapshot = await ref.get();
  const timestamp = now();

  if (!snapshot.exists) {
    const profile: CustomerProfile = {
      uid: identity.uid,
      email: identity.email,
      ...(identity.displayName?.trim() ? { displayName: identity.displayName.trim() } : {}),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await ref.create(profile);
    return profile;
  }

  const existing = snapshot.data() as CustomerProfile;
  const displayName = identity.displayName?.trim();
  const patch: Partial<CustomerProfile> = {};
  if (existing.email !== identity.email) patch.email = identity.email;
  if (displayName && !existing.displayName) patch.displayName = displayName;

  if (Object.keys(patch).length) {
    patch.updatedAt = timestamp;
    await ref.set(patch, { merge: true });
    return { ...existing, ...patch };
  }

  return existing;
}

export async function getCustomerProfile(uid: string): Promise<CustomerProfile | null> {
  const snapshot = await profileRef(uid).get();
  return snapshot.exists ? (snapshot.data() as CustomerProfile) : null;
}

export async function updateCustomerDisplayName(uid: string, displayName: string) {
  const normalized = displayName.trim();
  if (normalized.length < 2 || normalized.length > 80) {
    throw new Error("INVALID_DISPLAY_NAME");
  }

  await profileRef(uid).set(
    { displayName: normalized, updatedAt: now() },
    { merge: true },
  );
}

export async function listCustomerAddresses(uid: string): Promise<readonly CustomerAddress[]> {
  const snapshot = await profileRef(uid).collection(ADDRESSES_SUBCOLLECTION).orderBy("label", "asc").get();
  return snapshot.docs.map((item) => item.data() as CustomerAddress);
}

export async function getCustomerAddress(uid: string, addressId: string): Promise<CustomerAddress | null> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(addressId)) return null;
  const snapshot = await addressRef(uid, addressId).get();
  return snapshot.exists ? (snapshot.data() as CustomerAddress) : null;
}

export async function createCustomerAddress(uid: string, input: CustomerAddressInput): Promise<CustomerAddress> {
  const normalized = normalizeItalianAddress(input);
  const errors = validateItalianAddress(normalized);
  if (errors.length) throw new Error(`INVALID_ADDRESS:${errors[0]!.field}`);

  const collection = profileRef(uid).collection(ADDRESSES_SUBCOLLECTION);
  const existing = await collection.limit(MAX_ADDRESSES).get();
  if (existing.size >= MAX_ADDRESSES) throw new Error("ADDRESS_LIMIT_REACHED");

  const ref = collection.doc();
  const address: CustomerAddress = { id: ref.id, ...normalized };
  await ref.create(address);

  const profile = await getCustomerProfile(uid);
  if (!profile?.defaultShippingAddressId) {
    await profileRef(uid).set(
      { defaultShippingAddressId: address.id, updatedAt: now() },
      { merge: true },
    );
  }

  return address;
}

export async function updateCustomerAddress(
  uid: string,
  addressId: string,
  input: CustomerAddressInput,
): Promise<CustomerAddress> {
  const normalized = normalizeItalianAddress(input);
  const errors = validateItalianAddress(normalized);
  if (errors.length) throw new Error(`INVALID_ADDRESS:${errors[0]!.field}`);

  const ref = addressRef(uid, addressId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("ADDRESS_NOT_FOUND");

  const address: CustomerAddress = { id: addressId, ...normalized };
  await ref.set(address);
  return address;
}

export async function setDefaultShippingAddress(uid: string, addressId: string) {
  const db = getAdminFirestore();
  await db.runTransaction(async (transaction) => {
    const target = addressRef(uid, addressId);
    const snapshot = await transaction.get(target);
    if (!snapshot.exists) throw new Error("ADDRESS_NOT_FOUND");
    transaction.set(
      profileRef(uid),
      { defaultShippingAddressId: addressId, updatedAt: now() },
      { merge: true },
    );
  });
}

export async function deleteCustomerAddress(uid: string, addressId: string) {
  const db = getAdminFirestore();
  await db.runTransaction(async (transaction) => {
    const profile = profileRef(uid);
    const target = addressRef(uid, addressId);
    const [profileSnapshot, addressSnapshot] = await Promise.all([
      transaction.get(profile),
      transaction.get(target),
    ]);

    if (!addressSnapshot.exists) return;
    transaction.delete(target);

    const current = profileSnapshot.data() as CustomerProfile | undefined;
    if (current?.defaultShippingAddressId === addressId) {
      transaction.update(profile, {
        defaultShippingAddressId: FieldValue.delete(),
        updatedAt: now(),
      });
    }
  });
}

export async function listCustomerOrders(uid: string, maximum = 25): Promise<readonly Order[]> {
  const limit = Math.min(50, Math.max(1, Math.trunc(maximum)));
  const snapshot = await getAdminFirestore()
    .collection(ORDERS_COLLECTION)
    .where("customerId", "==", uid)
    .limit(limit)
    .get();

  return snapshot.docs
    .map((item) => item.data() as Order)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
