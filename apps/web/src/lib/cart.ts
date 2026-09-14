import { GARMENT_SIZES, type GarmentSize } from "@unsaid/domain";

export const CART_STORAGE_KEY = "unsaid:cart:v2";
export const CART_UPDATED_EVENT = "unsaid:cart-updated";
const MAX_LINE_QUANTITY = 20;

export interface CartLine {
  variantId: string;
  productId: string;
  size: GarmentSize;
  quantity: number;
}

function validLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  return Boolean(
    typeof line.variantId === "string" && line.variantId &&
    typeof line.productId === "string" && /^UNS-\d{4,}$/.test(line.productId) &&
    typeof line.size === "string" && GARMENT_SIZES.includes(line.size as GarmentSize) &&
    typeof line.quantity === "number" && Number.isInteger(line.quantity) &&
    line.quantity >= 1 && line.quantity <= MAX_LINE_QUANTITY,
  );
}

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validLine).slice(0, 25);
  } catch {
    return [];
  }
}

function persistCart(lines: readonly CartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
}

export function addCartLine(line: CartLine) {
  const current = readCart();
  const index = current.findIndex((item) => item.variantId === line.variantId);

  if (index >= 0) {
    const existing = current[index]!;
    current[index] = {
      ...existing,
      quantity: Math.min(MAX_LINE_QUANTITY, existing.quantity + line.quantity),
    };
  } else {
    current.push({ ...line, quantity: Math.min(MAX_LINE_QUANTITY, Math.max(1, line.quantity)) });
  }

  persistCart(current);
  return current;
}

export function setCartLineQuantity(variantId: string, quantity: number) {
  const current = readCart();
  const normalized = Math.min(MAX_LINE_QUANTITY, Math.max(0, Math.trunc(quantity)));
  const next = normalized === 0
    ? current.filter((line) => line.variantId !== variantId)
    : current.map((line) => line.variantId === variantId ? { ...line, quantity: normalized } : line);
  persistCart(next);
  return next;
}

export function removeCartLine(variantId: string) {
  const next = readCart().filter((line) => line.variantId !== variantId);
  persistCart(next);
  return next;
}

export function clearCart() {
  persistCart([]);
}

export function cartQuantity(lines = readCart()) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
