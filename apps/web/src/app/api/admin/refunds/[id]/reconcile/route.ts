import { NextResponse } from "next/server";
import {
  getStripeRefundReconciliationInput,
  recordStripeRefundProviderResponse,
} from "@unsaid/db";
import { AdminAuthError, requireAdminRequest } from "../../../../../../server/adminAuth";
import { rejectCrossOrigin } from "../../../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../../../server/logger";
import {
  createStripeRefund,
  retrieveStripeRefund,
  StripeRefundApiError,
} from "../../../../../../server/stripeRefund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = { params: Promise<{ id: string }> };

function enabled() {
  return process.env.STRIPE_PAYMENTS_ENABLED === "true"
    && process.env.STRIPE_REFUNDS_ENABLED === "true"
    && Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

function responseForError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json(
      { error: error.code },
      { status: error.code === "ADMIN_FORBIDDEN" ? 403 : 401 },
    );
  }
  if (error instanceof StripeRefundApiError) {
    return NextResponse.json(
      { error: error.status >= 400 && error.status < 500 ? "REFUND_RECONCILIATION_PROVIDER_REJECTED" : "REFUND_RECONCILIATION_AMBIGUOUS" },
      { status: error.status >= 400 && error.status < 500 ? 409 : 502 },
    );
  }
  const message = error instanceof Error ? error.message : "REFUND_RECONCILIATION_FAILED";
  if (/^INVALID_/.test(message)) return NextResponse.json({ error: message }, { status: 400 });
  if (message === "REFUND_CASE_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
  if (
    message === "REFUND_NOT_RECONCILABLE" ||
    message === "REFUND_STATE_MISSING" ||
    message === "PAYMENT_PROVIDER_ID_MISSING" ||
    message === "REFUND_CONTROL_AMOUNT_MISMATCH" ||
    message === "REFUND_CONTROL_INFLIGHT_MISMATCH" ||
    message === "REFUND_PROVIDER_AMOUNT_MISMATCH" ||
    message === "REFUND_PROVIDER_PAYMENT_MISMATCH" ||
    message === "REFUND_EXECUTION_STATE_CONFLICT"
  ) {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  logError("admin_refund_reconciliation.failed", error, { route: "/api/admin/refunds/[id]/reconcile" });
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}

export async function POST(request: Request, { params }: RouteProps) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!enabled()) return NextResponse.json({ error: "REFUNDS_DISABLED" }, { status: 503 });

  try {
    const admin = await requireAdminRequest(request);
    const { id } = await params;
    const reconciliation = await getStripeRefundReconciliationInput(id);

    const providerRefund = reconciliation.providerRefundId
      ? await retrieveStripeRefund(reconciliation.providerRefundId)
      : await createStripeRefund({
          refundCaseId: reconciliation.refundCase.id,
          orderId: reconciliation.order.id,
          paymentIntentId: reconciliation.paymentIntentId,
          amountCents: reconciliation.amountCents,
          internalReason: reconciliation.refundCase.reason,
        });

    if (providerRefund.amount !== reconciliation.amountCents) {
      throw new Error("REFUND_PROVIDER_AMOUNT_MISMATCH");
    }
    if (providerRefund.paymentIntentId && providerRefund.paymentIntentId !== reconciliation.paymentIntentId) {
      throw new Error("REFUND_PROVIDER_PAYMENT_MISMATCH");
    }

    const refundCase = await recordStripeRefundProviderResponse({
      refundCaseId: reconciliation.refundCase.id,
      providerRefundId: providerRefund.id,
      providerStatus: providerRefund.status,
      ...(providerRefund.failureReason ? { failureCode: providerRefund.failureReason } : {}),
    });

    logEvent("warn", "admin_refund_reconciliation.completed", {
      requestId,
      route: "/api/admin/refunds/[id]/reconcile",
      userId: admin.uid,
      orderId: reconciliation.order.id,
      refundCaseId: reconciliation.refundCase.id,
      providerRefundId: providerRefund.id,
      providerStatus: providerRefund.status,
      mode: reconciliation.providerRefundId ? "lookup" : "idempotent_replay",
    });
    return NextResponse.json({ refundCase }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return responseForError(error);
  }
}
