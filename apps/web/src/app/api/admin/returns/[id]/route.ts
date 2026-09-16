import {
  closeReturnCase,
  decideReturnCase,
  inspectReturnCase,
  linkReturnRefundCase,
  markReturnInTransit,
  markReturnReceived,
} from "@unsaid/db";
import type { ReturnInspectionLineInput } from "@unsaid/domain";
import { AdminAuthError, requireAdminRequest } from "../../../../../server/adminAuth";
import { rejectCrossOrigin } from "../../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = { params: Promise<{ id: string }> };

function optionalString(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

function inspectionLines(value: unknown): ReturnInspectionLineInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error("INVALID_RETURN_INSPECTION_LINES");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("INVALID_RETURN_INSPECTION_LINES");
    const row = entry as Record<string, unknown>;
    const variantId = typeof row.variantId === "string" ? row.variantId.slice(0, 120) : "";
    const receivedQuantity = Number(row.receivedQuantity);
    const restockQuantity = Number(row.restockQuantity);
    if (!variantId || !Number.isInteger(receivedQuantity) || !Number.isInteger(restockQuantity)) {
      throw new Error("INVALID_RETURN_INSPECTION_LINES");
    }
    return { variantId, receivedQuantity, restockQuantity };
  });
}

function responseForError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return Response.json({ error: error.code }, { status: error.code === "ADMIN_FORBIDDEN" ? 403 : 401 });
  }
  const code = error instanceof Error ? error.message : "RETURN_UPDATE_FAILED";
  if (/^INVALID_/.test(code)) return Response.json({ error: code }, { status: 400 });
  if (code === "RETURN_CASE_NOT_FOUND" || code === "REFUND_CASE_NOT_FOUND") return Response.json({ error: code }, { status: 404 });
  if (
    code === "RETURN_STATE_CONFLICT" ||
    code === "RETURN_NOT_READY_FOR_INSPECTION" ||
    code === "RETURN_INSPECTION_LINES_MISMATCH" ||
    code === "RETURN_INVENTORY_MISSING" ||
    code === "RETURN_REFUND_MISMATCH" ||
    code === "RETURN_REFUND_ALREADY_LINKED"
  ) {
    return Response.json({ error: code }, { status: 409 });
  }
  return null;
}

export async function POST(request: Request, { params }: RouteProps) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;

  try {
    const admin = await requireAdminRequest(request);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    let returnCase;

    if (action === "approve" || action === "reject") {
      returnCase = await decideReturnCase({ returnCaseId: id, action });
    } else if (action === "in_transit") {
      returnCase = await markReturnInTransit({
        returnCaseId: id,
        provider: optionalString(body.provider, 80),
        trackingCode: optionalString(body.trackingCode, 120),
        trackingUrl: optionalString(body.trackingUrl, 500),
      });
    } else if (action === "received") {
      returnCase = await markReturnReceived(id);
    } else if (action === "inspect") {
      returnCase = await inspectReturnCase({ returnCaseId: id, lines: inspectionLines(body.lines) });
    } else if (action === "link_refund") {
      const refundCaseId = optionalString(body.refundCaseId, 180) ?? "";
      returnCase = await linkReturnRefundCase({ returnCaseId: id, refundCaseId });
    } else if (action === "close") {
      returnCase = await closeReturnCase(id);
    } else {
      return Response.json({ error: "INVALID_RETURN_ACTION" }, { status: 400 });
    }

    logEvent("warn", "admin_return.updated", {
      requestId,
      route: "/api/admin/returns/[id]",
      userId: admin.uid,
      returnCaseId: id,
      action,
      status: returnCase.status,
    });
    return Response.json({ returnCase }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const known = responseForError(error);
    if (known) return known;
    logError("admin_return.update_failed", error, { requestId, route: "/api/admin/returns/[id]" });
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
