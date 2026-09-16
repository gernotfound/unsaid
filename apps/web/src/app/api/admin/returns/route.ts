import { listAdminReturnCases } from "@unsaid/db";
import { AdminAuthError, requireAdminRequest } from "../../../../server/adminAuth";
import { createRequestId, logError, logEvent } from "../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = createRequestId();
  try {
    const admin = await requireAdminRequest(request);
    const items = await listAdminReturnCases(75);
    logEvent("info", "admin_returns.list", {
      requestId,
      route: "/api/admin/returns",
      userId: admin.uid,
      count: items.length,
    });
    return Response.json({ items }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return Response.json(
        { error: error.code },
        { status: error.code === "ADMIN_FORBIDDEN" ? 403 : 401 },
      );
    }
    logError("admin_returns.list_failed", error, { requestId, route: "/api/admin/returns" });
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
