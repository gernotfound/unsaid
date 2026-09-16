import { NextResponse } from "next/server";
import {
  beginStripeRefundExecution,
  markStripeRefundAmbiguous,
  markStripeRefundStartRejected,
  recordStripeRefundProviderResponse,
} from "@unsaid/db";
import { AdminAuthError, requireAdminRequest } from "../../../../../../server/adminAuth";
import { rejectCrossOrigin } from "../../../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../../../server/logger";
import { createStripeRefund, StripeRefundApiError } from "../../../../../../server/stripeRefund";

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
  const message = error instanceof Error ? error.message : "REFUND_EXECUTION_FAILED";
  if (/^INVALID_/.test(message)) return NextResponse.json({ error: message }, { status: 400 });
  if (message === "REFUND_CASE_NOT_FOUND" || message === "ORDER_NOT_FOUND" || message === "PAYMENT_NOT_FOUND") {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  if (
    message === "ORDER_NOT_REFUND_ELIGIBLE" ||
    message === "PAYMENT_NOT_REFUND_ELIGIBLE" ||
    message === "PAYMENT_PROVIDER_ID_MISSING" ||
    message === "REFUND_ALREADY_COMPLETE" ||
    message === "REFUND_EXECUTION_ALREADY_ACTIVE" ||
    message === "REFUND_NOT_EXECUTABLE" ||
    message === "REFUND_AMOUNT_EXCEEDS_REMAINING" ||
    message === "REFUND_CONTROL_AMOUNT_MISMATCH" ||
    message === "REFUND_EXECUTION_STATE_CONFLICT"
  ) {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  logError("admin_refund_execution.failed", error, { route: "/api/admin/refunds/[id]/execute" });
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
    const execution = await beginStripeRefundExecution({ refundCaseId: id, adminUid: admin.uid });

    try {
      const providerRefund = await createStripeRefund({
        refundCaseId: execution.refundCase.id,
        orderId: execution.refundCase.orderId,
        paymentIntentId: execution.paymentIntentId,
        amountCents: execution.amountCents,
        internalReason: execution.refundCase.reason,
      });
      const refundCase = await recordStripeRefundProviderResponse({
        refundCaseId: execution.refundCase.id,
        providerRefundId: providerRefund.id,
        providerStatus: providerRefund.status,
        ...(providerRefund.failureReason ? { failureCode: providerRefund.failureReason } : {}),
      });
      logEvent("warn", "admin_refund_execution.provider_created", {
        requestId,
        route: "/api/admin/refunds/[id]/execute",
        userId: admin.uid,
        orderId: execution.refundCase.orderId,
        refundCaseId: execution.refundCase.id,
        providerRefundId: providerRefund.id,
        providerStatus: providerRefund.status,
        amountCents: execution.amountCents,
      });
      return NextResponse.json({ refundCase }, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      if (error instanceof StripeRefundApiError) {
        if (error.status >= 400 && error.status < 500) {
          await markStripeRefundStartRejected({
            refundCaseId: execution.refundCase.id,
            failureCode: error.code,
          });
        } else {
          await markStripeRefundAmbiguous({
            refundCaseId: execution.refundCase.id,
            failureCode: error.code,
          });
        }
        logEvent("error", "admin_refund_execution.provider_error", {
          requestId,
          route: "/api/admin/refunds/[id]/execute",
          userId: admin.uid,
          orderId: execution.refundCase.orderId,
          refundCaseId: execution.refundCase.id,
          stripeCode: error.code,
          stripeStatus: error.status,
        });
        return NextResponse.json(
          { error: error.status >= 400 && error.status < 500 ? "REFUND_PROVIDER_REJECTED" : "REFUND_PROVIDER_AMBIGUOUS" },
          { status: error.status >= 400 && error.status < 500 ? 409 : 502 },
        );
      }
      await markStripeRefundAmbiguous({
        refundCaseId: execution.refundCase.id,
        failureCode: "UNEXPECTED_PROVIDER_ERROR",
      });
      throw error;
    }
  } catch (error) {
    return responseForError(error);
  }
}
