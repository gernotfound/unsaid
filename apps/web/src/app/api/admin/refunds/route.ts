import { NextResponse } from "next/server";
import { listAdminRefundCases } from "@unsaid/db";
import { AdminAuthError, requireAdminRequest } from "../../../../server/adminAuth";
import { createRequestId, logError, logEvent } from "../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    const admin = await requireAdminRequest(request);
    const items = await listAdminRefundCases(75);
    logEvent("info", "admin_refunds.list", {
      requestId,
      route: "/api/admin/refunds",
      userId: admin.uid,
      count: items.length,
    });
    return NextResponse.json({ items }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.code === "ADMIN_FORBIDDEN" ? 403 : 401 },
      );
    }
    logError("admin_refunds.list_failed", error, { requestId, route: "/api/admin/refunds" });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
