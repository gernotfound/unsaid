import { NextResponse } from "next/server";
import { validatePublicCart, type CartValidationInputLine } from "@unsaid/db";
import { FEATURES } from "../../../../lib/features";
import { logError } from "../../../../server/logger";

export const dynamic = "force-dynamic";

function parseLines(value: unknown): CartValidationInputLine[] {
  if (!value || typeof value !== "object") throw new Error("INVALID_CART");
  const lines = (value as { lines?: unknown }).lines;
  if (!Array.isArray(lines) || lines.length > 25) throw new Error("INVALID_CART");

  return lines.map((line) => {
    if (!line || typeof line !== "object") return { variantId: "", quantity: 0 };
    const record = line as Record<string, unknown>;
    return {
      variantId: typeof record.variantId === "string" ? record.variantId : "",
      quantity: Number(record.quantity),
    };
  });
}

export async function POST(request: Request) {
  try {
    const lines = parseLines(await request.json());
    const cart = await validatePublicCart(lines);
    return NextResponse.json(
      {
        ...cart,
        shopEnabled: FEATURES.shopEnabled,
        checkoutEnabled: false,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "INVALID_CART";
    if (message === "INVALID_CART" || message === "CART_TOO_LARGE") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    logError("cart_validation_failed", error, { route: "/api/cart/validate" });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
