import { NextResponse } from "next/server";
import {
  getCustomerAddress,
  preparePendingOrder,
  type CheckoutCartLineInput,
} from "@unsaid/db";
import { FEATURES } from "../../../../lib/features";
import { getCheckoutConfiguration } from "../../../../lib/checkout";
import { CustomerAuthError, requireCustomerSession } from "../../../../server/customerSession";
import { apiError, rejectCrossOrigin } from "../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLines(value: unknown): CheckoutCartLineInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 25) throw new Error("INVALID_CART");
  return value.map((line) => {
    if (!line || typeof line !== "object") throw new Error("INVALID_CART");
    const record = line as Record<string, unknown>;
    return {
      variantId: typeof record.variantId === "string" ? record.variantId : "",
      quantity: Number(record.quantity),
    };
  });
}

function clientError(message: string) {
  if (message === "CART_EMPTY" || message === "CART_TOO_LARGE" || message === "INVALID_CART" || message === "INVALID_VARIANT" || message === "INVALID_QUANTITY" || message === "INVALID_IDEMPOTENCY_KEY") {
    return apiError(message, 400);
  }
  if (message === "IDEMPOTENCY_CONFLICT" || message === "CHECKOUT_STATE_CONFLICT") return apiError(message, 409);
  if (message.startsWith("VARIANT_UNAVAILABLE:") || message.startsWith("PRODUCT_UNAVAILABLE:") || message.startsWith("OUT_OF_STOCK:")) {
    return apiError(message, 409);
  }
  if (message === "INVALID_SHIPPING_ADDRESS" || message === "ADDRESS_NOT_FOUND") return apiError(message, 409);
  return null;
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!FEATURES.checkoutPreparationEnabled) return apiError("CHECKOUT_DISABLED", 403);

  try {
    const session = await requireCustomerSession({ verifiedEmail: true, checkRevoked: true });
    const body = (await request.json()) as Record<string, unknown>;
    const addressId = typeof body.addressId === "string" ? body.addressId : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    const lines = parseLines(body.lines);
    const address = await getCustomerAddress(session.uid, addressId);
    if (!address) throw new Error("ADDRESS_NOT_FOUND");

    const configuration = getCheckoutConfiguration();
    if (
      !configuration.ready ||
      configuration.standardShippingCents == null ||
      configuration.vatRateBps == null
    ) {
      return apiError("CHECKOUT_CONFIGURATION_INCOMPLETE", 503);
    }

    const order = await preparePendingOrder({
      customerId: session.uid,
      email: session.email,
      shippingAddress: address,
      lines,
      idempotencyKey,
      pricing: {
        standardShippingCents: configuration.standardShippingCents,
        freeShippingThresholdCents: configuration.freeShippingThresholdCents,
        vatRateBps: configuration.vatRateBps,
        reservationMinutes: configuration.reservationMinutes,
      },
    });

    logEvent("info", "checkout_pending_order_created", {
      requestId,
      route: "/api/checkout/prepare",
      userId: session.uid,
      orderId: order.id,
      lineCount: order.lines.length,
    });
    return NextResponse.json({ order, paymentEnabled: false }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof CustomerAuthError) {
      return apiError(error.code, error.code === "EMAIL_NOT_VERIFIED" ? 403 : 401);
    }
    const message = error instanceof Error ? error.message : "CHECKOUT_PREPARE_FAILED";
    const handled = clientError(message);
    if (handled) return handled;
    logError("checkout.prepare_failed", error, { requestId, route: "/api/checkout/prepare" });
    return apiError("CHECKOUT_PREPARE_FAILED", 500);
  }
}
