import { NextResponse } from "next/server";
import { listAdminOrdersPage } from "@unsaid/db";
import { AdminAuthError, requireAdminRequest } from "../../../../server/adminAuth";
import { createRequestId, logError, logEvent } from "../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json(
      { error: error.code },
      { status: error.code === "ADMIN_FORBIDDEN" ? 403 : 401 },
    );
  }
  const message = error instanceof Error ? error.message : "ADMIN_ORDERS_FAILED";
  if (message === "INVALID_CURSOR") return NextResponse.json({ error: message }, { status: 400 });
  logError("admin_orders.list_failed", error, { route: "/api/admin/orders" });
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}

export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    const admin = await requireAdminRequest(request);
    const url = new URL(request.url);
    const cursorRaw = url.searchParams.get("cursor");
    let afterCreatedAt: string | undefined;
    if (cursorRaw) {
      const parsed = new Date(cursorRaw);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== cursorRaw) throw new Error("INVALID_CURSOR");
      afterCreatedAt = cursorRaw;
    }
    const page = await listAdminOrdersPage({ ...(afterCreatedAt ? { afterCreatedAt } : {}), limit: 25 });
    logEvent("info", "admin_orders.list", {
      requestId,
      route: "/api/admin/orders",
      userId: admin.uid,
      count: page.items.length,
    });
    return NextResponse.json(page, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
