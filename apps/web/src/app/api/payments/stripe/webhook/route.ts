import { NextResponse } from "next/server";
import {
  applyStripeCheckoutExpired,
  applyStripeCheckoutPaid,
  applyStripeRefundWebhook,
  type StripeCheckoutSessionEventData,
  type StripeRefundEventData,
} from "@unsaid/db";
import { createRequestId, logError, logEvent } from "../../../../../server/logger";
import {
  StripeWebhookError,
  verifyStripeWebhookSignature,
} from "../../../../../server/stripeWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function metadata(value: unknown) {
  return value && typeof value === "object"
    ? Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      )
    : null;
}

function checkoutSession(value: Record<string, unknown>): StripeCheckoutSessionEventData | null {
  if (typeof value.id !== "string") return null;
  const paymentIntentObjectId = value.payment_intent && typeof value.payment_intent === "object"
    && typeof (value.payment_intent as Record<string, unknown>).id === "string"
    ? String((value.payment_intent as Record<string, unknown>).id)
    : null;
  const paymentIntent = typeof value.payment_intent === "string"
    ? value.payment_intent
    : paymentIntentObjectId
      ? { id: paymentIntentObjectId }
      : null;

  return {
    id: value.id,
    payment_status: typeof value.payment_status === "string" ? value.payment_status : null,
    status: typeof value.status === "string" ? value.status : null,
    amount_total: typeof value.amount_total === "number" ? value.amount_total : null,
    currency: typeof value.currency === "string" ? value.currency : null,
    client_reference_id: typeof value.client_reference_id === "string" ? value.client_reference_id : null,
    payment_intent: paymentIntent,
    metadata: metadata(value.metadata),
  };
}

function refundObject(value: Record<string, unknown>): StripeRefundEventData | null {
  if (typeof value.id !== "string" || !value.id.startsWith("re_")) return null;
  const paymentIntent = typeof value.payment_intent === "string"
    ? value.payment_intent
    : value.payment_intent && typeof value.payment_intent === "object" && typeof (value.payment_intent as Record<string, unknown>).id === "string"
      ? String((value.payment_intent as Record<string, unknown>).id)
      : null;
  return {
    id: value.id,
    status: typeof value.status === "string" ? value.status : null,
    amount: typeof value.amount === "number" ? value.amount : null,
    payment_intent: paymentIntent,
    failure_reason: typeof value.failure_reason === "string" ? value.failure_reason : null,
    metadata: metadata(value.metadata),
  };
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 503 });

  try {
    const rawBody = await request.text();
    const event = verifyStripeWebhookSignature(
      rawBody,
      request.headers.get("stripe-signature"),
      secret,
    );

    let result: unknown = { outcome: "ignored_event_type" };
    let providerObjectId: string | undefined;

    if (event.type === "refund.updated" || event.type === "refund.failed") {
      const refund = refundObject(event.data.object);
      if (!refund) {
        result = { outcome: "ignored_invalid_refund_object" };
      } else {
        providerObjectId = refund.id;
        result = await applyStripeRefundWebhook({
          eventId: event.id,
          eventType: event.type,
          refund,
        });
      }
    } else {
      const session = checkoutSession(event.data.object);
      if (!session) {
        logEvent("warn", "stripe.webhook_ignored_invalid_object", {
          requestId,
          route: "/api/payments/stripe/webhook",
          eventId: event.id,
          eventType: event.type,
        });
        return NextResponse.json({ received: true, outcome: "ignored_invalid_object" });
      }
      providerObjectId = session.id;
      if (
        (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
        session.payment_status === "paid"
      ) {
        result = await applyStripeCheckoutPaid({
          eventId: event.id,
          eventType: event.type,
          session,
        });
      } else if (
        event.type === "checkout.session.expired" ||
        event.type === "checkout.session.async_payment_failed"
      ) {
        result = await applyStripeCheckoutExpired({
          eventId: event.id,
          eventType: event.type,
          session,
        });
      } else if (event.type === "checkout.session.completed") {
        result = { outcome: "awaiting_payment" };
      }
    }

    logEvent("info", "stripe.webhook_processed", {
      requestId,
      route: "/api/payments/stripe/webhook",
      eventId: event.id,
      eventType: event.type,
      providerObjectId,
      result,
    });
    return NextResponse.json({ received: true, result });
  } catch (error) {
    if (error instanceof StripeWebhookError) {
      logEvent("warn", "stripe.webhook_rejected", {
        requestId,
        route: "/api/payments/stripe/webhook",
        reason: error.code,
      });
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    logError("stripe.webhook_failed", error, {
      requestId,
      route: "/api/payments/stripe/webhook",
    });
    return NextResponse.json({ error: "WEBHOOK_PROCESSING_FAILED" }, { status: 500 });
  }
}
