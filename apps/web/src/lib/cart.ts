export const CART_STORAGE_KEY = "unsaid:cart:v1";

export type CartSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export interface CartLine {
  productId: string;
  slug: string;
  title: string;
  size: CartSize;
  quantity: number;
  unitPrice: number;
}

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function addCartLine(line: CartLine) {
  const current = readCart();
  const index = current.findIndex(
    (item) => item.productId === line.productId && item.size === line.size,
  );

  if (index >= 0) {
    current[index] = { ...current[index]!, quantity: current[index]!.quantity + line.quantity };
  } else {
    current.push(line);
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent("unsaid:cart-updated"));
  return current;
}
