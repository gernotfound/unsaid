import { NextResponse } from "next/server";
import { getCustomerPaymentStatus } from "@unsaid/db";
import { FEATURES } from "../../../../lib/features";
import { CustomerAuthError, requireCustomerSession } from "../../../../server/customerSession";
import { apiError } from "../../../../server/http";
import { createRequestId, logError } from "../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = createRequestId();
  if (!FEATURES.customerAccountsEnabled) return apiError("ACCOUNTS_DISABLED", 403);

  try {
    const session = await requireCustomerSession({ checkRevoked: true });
    const orderId = new URL(request.url).searchParams.get("orderId")?.trim() ?? "";
    if (!orderId) return apiError("INVALID_ORDER_ID", 400);

    const status = await getCustomerPaymentStatus({
      customerId: session.uid,
      orderId,
    });
    return NextResponse.json(status, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof CustomerAuthError) return apiError(error.code, 401);
    const message = error instanceof Error ? error.message : "PAYMENT_STATUS_FAILED";
    if (message === "INVALID_ORDER_ID") return apiError(message, 400);
    if (message === "ORDER_NOT_FOUND") return apiError(message, 404);
    if (message === "ORDER_FORBIDDEN") return apiError(message, 403);
    logError("payment.status_failed", error, {
      requestId,
      route: "/api/payments/status",
    });
    return apiError("PAYMENT_STATUS_FAILED", 500);
  }
}
