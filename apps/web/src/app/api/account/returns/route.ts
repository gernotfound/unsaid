import { createCustomerReturnRequest } from "@unsaid/db";
import { RETURN_REASON_CODES, type ReturnReasonCode, type ReturnRequestLineInput } from "@unsaid/domain";
import { FEATURES } from "../../../../lib/features";
import { requireCustomerSession, CustomerAuthError } from "../../../../server/customerSession";
import { apiError, rejectCrossOrigin } from "../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLines(value: unknown): ReturnRequestLineInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error("INVALID_RETURN_LINES");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("INVALID_RETURN_LINES");
    const row = entry as Record<string, unknown>;
    const variantId = typeof row.variantId === "string" ? row.variantId.slice(0, 120) : "";
    const quantity = Number(row.quantity);
    if (!variantId || !Number.isInteger(quantity)) throw new Error("INVALID_RETURN_LINES");
    return { variantId, quantity };
  });
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!FEATURES.returnsEnabled) return apiError("RETURNS_DISABLED", 403);

  try {
    const session = await requireCustomerSession({ checkRevoked: true });
    const body = (await request.json()) as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const reasonCode = typeof body.reasonCode === "string" ? body.reasonCode : "";
    if (!RETURN_REASON_CODES.includes(reasonCode as ReturnReasonCode)) return apiError("INVALID_RETURN_REASON", 400);
    const note = typeof body.note === "string" ? body.note.slice(0, 1000) : undefined;
    const returnCase = await createCustomerReturnRequest({
      customerId: session.uid,
      orderId,
      reasonCode: reasonCode as ReturnReasonCode,
      ...(note?.trim() ? { note } : {}),
      lines: parseLines(body.lines),
    });
    logEvent("info", "customer.return.requested", {
      requestId,
      route: "/api/account/returns",
      userId: session.uid,
      orderId,
      returnCaseId: returnCase.id,
    });
    return Response.json({ returnCase }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof CustomerAuthError) return apiError(error.code, 401);
    const code = error instanceof Error ? error.message : "RETURN_REQUEST_FAILED";
    if (/^INVALID_/.test(code)) return apiError(code, 400);
    if (code === "ORDER_NOT_FOUND") return apiError(code, 404);
    if (code === "ORDER_FORBIDDEN") return apiError(code, 403);
    if (code === "ORDER_NOT_RETURN_ELIGIBLE" || code === "RETURN_ALREADY_EXISTS" || code === "RETURN_LINE_NOT_IN_ORDER" || code === "RETURN_LINES_REQUIRED") {
      return apiError(code, 409);
    }
    logError("customer.return.request_failed", error, { requestId, route: "/api/account/returns" });
    return apiError("RETURN_REQUEST_FAILED", 500);
  }
}
