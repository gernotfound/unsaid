import { NextResponse } from "next/server";
import { createRefundCase, getAdminOrderDetail } from "@unsaid/db";
import { validateRefundCaseInput } from "../../../../../../lib/refund";
import { AdminAuthError, requireAdminRequest } from "../../../../../../server/adminAuth";
import { rejectCrossOrigin } from "../../../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = { params: Promise<{ id: string }> };

function responseForError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json(
      { error: error.code },
      { status: error.code === "ADMIN_FORBIDDEN" ? 403 : 401 },
    );
  }
  const message = error instanceof Error ? error.message : "REFUND_CASE_FAILED";
  if (/^INVALID_/.test(message)) return NextResponse.json({ error: message }, { status: 400 });
  if (message === "ORDER_NOT_FOUND" || message === "PAYMENT_NOT_FOUND") {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  if (
    message === "ORDER_NOT_REFUND_ELIGIBLE" ||
    message === "PAYMENT_NOT_REFUND_ELIGIBLE" ||
    message === "REFUND_AMOUNT_EXCEEDS_PAYMENT" ||
    message === "REFUND_IDEMPOTENCY_CONFLICT"
  ) {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  logError("admin_refund_case.failed", error, { route: "/api/admin/orders/[id]/refund" });
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}

export async function POST(request: Request, { params }: RouteProps) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;

  try {
    const admin = await requireAdminRequest(request);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const detail = await getAdminOrderDetail(id);
    const amountCents = Number(body.amountCents);
    const reason = typeof body.reason === "string" ? body.reason : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    const validation = validateRefundCaseInput({
      amountCents,
      maxAmountCents: detail.order.totals.total.amountCents,
      reason,
    });
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });

    const refundCase = await createRefundCase({
      orderId: id,
      adminUid: admin.uid,
      amountCents,
      reason: validation.reason,
      idempotencyKey,
    });
    logEvent("warn", "admin_refund_case.created", {
      requestId,
      route: "/api/admin/orders/[id]/refund",
      userId: admin.uid,
      orderId: id,
      refundCaseId: refundCase.id,
      amountCents,
      providerAction: refundCase.providerAction,
    });
    return NextResponse.json(
      { refundCase, detail: await getAdminOrderDetail(id) },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return responseForError(error);
  }
}
