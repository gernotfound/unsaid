import { NextResponse } from "next/server";
import { cancelPendingOrder } from "@unsaid/db";
import { FEATURES } from "../../../../lib/features";
import { CustomerAuthError, requireCustomerSession } from "../../../../server/customerSession";
import { apiError, rejectCrossOrigin } from "../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!FEATURES.customerAccountsEnabled) return apiError("ACCOUNTS_DISABLED", 403);

  try {
    const session = await requireCustomerSession({ checkRevoked: true });
    const body = (await request.json()) as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!orderId) return apiError("INVALID_ORDER_ID", 400);

    const order = await cancelPendingOrder({ customerId: session.uid, orderId });
    logEvent("info", "checkout_pending_order_cancelled", {
      requestId,
      route: "/api/checkout/cancel",
      userId: session.uid,
      orderId: order.id,
    });
    return NextResponse.json({ order }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof CustomerAuthError) return apiError(error.code, 401);
    const message = error instanceof Error ? error.message : "CHECKOUT_CANCEL_FAILED";
    if (message === "INVALID_ORDER_ID") return apiError(message, 400);
    if (message === "ORDER_NOT_FOUND") return apiError(message, 404);
    if (message === "ORDER_FORBIDDEN") return apiError(message, 403);
    if (message === "ORDER_NOT_CANCELLABLE" || message === "RESERVATION_CONFLICT") return apiError(message, 409);
    logError("checkout.cancel_failed", error, { requestId, route: "/api/checkout/cancel" });
    return apiError("CHECKOUT_CANCEL_FAILED", 500);
  }
}
