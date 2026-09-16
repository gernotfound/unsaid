import { NextResponse } from "next/server";
import {
  beginStripePaymentSession,
  completeStripePaymentSession,
  failStripePaymentSessionStart,
} from "@unsaid/db";
import { FEATURES } from "../../../../../lib/features";
import { getPaymentConfiguration } from "../../../../../lib/payment";
import { CustomerAuthError, requireCustomerSession } from "../../../../../server/customerSession";
import { apiError, rejectCrossOrigin } from "../../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../../server/logger";
import { createStripeCheckoutSession, StripeApiError } from "../../../../../server/stripeCheckout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientError(message: string) {
  if (message === "INVALID_ORDER_ID") return apiError(message, 400);
  if (message === "ORDER_NOT_FOUND") return apiError(message, 404);
  if (message === "ORDER_FORBIDDEN") return apiError(message, 403);
  if (
    message === "ORDER_NOT_PAYABLE" ||
    message === "ORDER_RESERVATION_EXPIRED" ||
    message === "RESERVATION_NOT_FOUND" ||
    message === "RESERVATION_CONFLICT" ||
    message === "PAYMENT_SESSION_IN_PROGRESS" ||
    message === "PAYMENT_SESSION_STATE_CONFLICT"
  ) {
    return apiError(message, 409);
  }
  return null;
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!FEATURES.paymentEnabled) return apiError("PAYMENTS_DISABLED", 403);

  let customerId = "";
  let orderId = "";
  let providerCreationStarted = false;

  try {
    const session = await requireCustomerSession({ verifiedEmail: true, checkRevoked: true });
    customerId = session.uid;
    const body = (await request.json()) as Record<string, unknown>;
    orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!orderId) return apiError("INVALID_ORDER_ID", 400);

    const configuration = getPaymentConfiguration();
    if (!configuration.ready || !configuration.siteUrl) {
      return apiError("PAYMENT_CONFIGURATION_INCOMPLETE", 503);
    }

    const prepared = await beginStripePaymentSession({
      customerId,
      orderId,
      sessionMinutes: configuration.sessionMinutes,
    });

    if (!prepared.createProviderSession) {
      if (!prepared.intent.checkoutUrl) return apiError("PAYMENT_SESSION_STATE_CONFLICT", 409);
      return NextResponse.json(
        {
          orderId,
          checkoutUrl: prepared.intent.checkoutUrl,
          expiresAt: prepared.intent.providerExpiresAt,
          reused: true,
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    providerCreationStarted = true;
    const stripeSession = await createStripeCheckoutSession({
      order: prepared.order,
      siteUrl: configuration.siteUrl,
      providerExpiresAt: prepared.intent.providerExpiresAt,
    });
    const intent = await completeStripePaymentSession({
      customerId,
      orderId,
      providerSessionId: stripeSession.id,
      checkoutUrl: stripeSession.url,
      providerExpiresAt: stripeSession.expiresAt,
    });

    logEvent("info", "stripe.checkout_session_created", {
      requestId,
      route: "/api/payments/stripe/session",
      userId: customerId,
      orderId,
      providerSessionId: stripeSession.id,
    });
    return NextResponse.json(
      {
        orderId,
        checkoutUrl: intent.checkoutUrl,
        expiresAt: intent.providerExpiresAt,
        reused: false,
      },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (providerCreationStarted && customerId && orderId) {
      await failStripePaymentSessionStart({
        customerId,
        orderId,
        errorCode: error instanceof Error ? error.message : "STRIPE_SESSION_CREATE_FAILED",
      }).catch(() => undefined);
    }
    if (error instanceof CustomerAuthError) {
      return apiError(error.code, error.code === "EMAIL_NOT_VERIFIED" ? 403 : 401);
    }
    const message = error instanceof Error ? error.message : "PAYMENT_SESSION_FAILED";
    const handled = clientError(message);
    if (handled) return handled;
    if (error instanceof StripeApiError) {
      logError("stripe.checkout_session_failed", error, {
        requestId,
        route: "/api/payments/stripe/session",
        ...(customerId ? { userId: customerId } : {}),
        ...(orderId ? { orderId } : {}),
        stripeStatus: error.status,
      });
      return apiError("PAYMENT_PROVIDER_UNAVAILABLE", 502);
    }
    logError("payment.session_failed", error, {
      requestId,
      route: "/api/payments/stripe/session",
      ...(customerId ? { userId: customerId } : {}),
      ...(orderId ? { orderId } : {}),
    });
    return apiError("PAYMENT_SESSION_FAILED", 500);
  }
}
