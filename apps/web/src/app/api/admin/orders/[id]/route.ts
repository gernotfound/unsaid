import { NextResponse } from "next/server";
import {
  cancelPendingOrderWithPaymentGuard,
  getAdminOrderDetail,
  markAdminOrderProcessing,
} from "@unsaid/db";
import { AdminAuthError, requireAdminRequest } from "../../../../../server/adminAuth";
import { rejectCrossOrigin } from "../../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../../server/logger";

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
  const message = error instanceof Error ? error.message : "ADMIN_ORDER_FAILED";
  if (message === "INVALID_ORDER_ID") return NextResponse.json({ error: message }, { status: 400 });
  if (message === "ORDER_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
  if (
    message === "ORDER_NOT_READY_FOR_PROCESSING" ||
    message === "PAYMENT_NOT_CONFIRMED" ||
    message === "ORDER_NOT_CANCELLABLE" ||
    message === "PAYMENT_SESSION_ACTIVE" ||
    message === "RESERVATION_CONFLICT"
  ) {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  logError("admin_orders.detail_failed", error, { route: "/api/admin/orders/[id]" });
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}

export async function GET(request: Request, { params }: RouteProps) {
  const requestId = createRequestId();
  try {
    const admin = await requireAdminRequest(request);
    const { id } = await params;
    const detail = await getAdminOrderDetail(id);
    logEvent("info", "admin_orders.detail", {
      requestId,
      route: "/api/admin/orders/[id]",
      userId: admin.uid,
      orderId: id,
    });
    return NextResponse.json(detail, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return responseForError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;

  try {
    const admin = await requireAdminRequest(request);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "processing") {
      await markAdminOrderProcessing(id);
    } else if (action === "cancel") {
      const detail = await getAdminOrderDetail(id);
      await cancelPendingOrderWithPaymentGuard({
        customerId: detail.order.customerId,
        orderId: id,
      });
    } else {
      return NextResponse.json({ error: "INVALID_ADMIN_ORDER_ACTION" }, { status: 400 });
    }

    const detail = await getAdminOrderDetail(id);
    logEvent("info", "admin_orders.action", {
      requestId,
      route: "/api/admin/orders/[id]",
      userId: admin.uid,
      orderId: id,
      action,
    });
    return NextResponse.json(detail, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return responseForError(error);
  }
}
