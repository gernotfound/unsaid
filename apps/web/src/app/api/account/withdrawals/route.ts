import { listCustomerWithdrawals, recordCustomerWithdrawalNotice } from "@unsaid/db";
import { WITHDRAWAL_SCOPES, type WithdrawalLineInput, type WithdrawalScope } from "@unsaid/domain";
import { FEATURES } from "../../../../lib/features";
import { CustomerAuthError, requireCustomerSession } from "../../../../server/customerSession";
import { apiError, rejectCrossOrigin } from "../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLines(value: unknown): WithdrawalLineInput[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new Error("INVALID_WITHDRAWAL_LINES");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("INVALID_WITHDRAWAL_LINES");
    const row = entry as Record<string, unknown>;
    const variantId = typeof row.variantId === "string" ? row.variantId.slice(0, 120) : "";
    const quantity = Number(row.quantity);
    if (!variantId || !Number.isInteger(quantity)) throw new Error("INVALID_WITHDRAWAL_LINES");
    return { variantId, quantity };
  });
}

export async function GET() {
  if (!FEATURES.customerAccountsEnabled) return apiError("ACCOUNTS_DISABLED", 403);
  try {
    const session = await requireCustomerSession({ checkRevoked: true });
    const withdrawalNotices = await listCustomerWithdrawals(session.uid);
    return Response.json({ withdrawalNotices }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CustomerAuthError) return apiError(error.code, 401);
    logError("customer.withdrawal.list_failed", error, { route: "/api/account/withdrawals" });
    return apiError("WITHDRAWAL_LIST_FAILED", 500);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!FEATURES.withdrawalEnabled) return apiError("WITHDRAWAL_DISABLED", 403);

  try {
    const session = await requireCustomerSession({ checkRevoked: true });
    const body = (await request.json()) as Record<string, unknown>;
    if (body.confirmWithdrawal !== true) return apiError("WITHDRAWAL_CONFIRMATION_REQUIRED", 400);

    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const consumerName = typeof body.consumerName === "string" ? body.consumerName.slice(0, 120) : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    const scope = typeof body.scope === "string" ? body.scope : "";
    if (!WITHDRAWAL_SCOPES.includes(scope as WithdrawalScope)) return apiError("INVALID_WITHDRAWAL_SCOPE", 400);

    const withdrawalNotice = await recordCustomerWithdrawalNotice({
      customerId: session.uid,
      orderId,
      consumerName,
      acknowledgementEmail: session.email,
      scope: scope as WithdrawalScope,
      lines: parseLines(body.lines),
      idempotencyKey,
    });

    logEvent("info", "customer.withdrawal.submitted", {
      requestId,
      route: "/api/account/withdrawals",
      userId: session.uid,
      orderId,
      withdrawalNoticeId: withdrawalNotice.id,
    });
    return Response.json(
      { withdrawalNotice },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CustomerAuthError) return apiError(error.code, 401);
    const code = error instanceof Error ? error.message : "WITHDRAWAL_SUBMISSION_FAILED";
    if (
      /^INVALID_/.test(code) ||
      code === "WITHDRAWAL_LINES_REQUIRED" ||
      code === "WHOLE_ORDER_WITHDRAWAL_LINES_NOT_ALLOWED" ||
      code === "WITHDRAWAL_ORDER_LINES_MISSING" ||
      code === "WITHDRAWAL_LINE_NOT_IN_ORDER"
    ) {
      return apiError(code, 400);
    }
    if (code === "ORDER_NOT_FOUND") return apiError(code, 404);
    if (code === "ORDER_FORBIDDEN") return apiError(code, 403);
    if (code === "WITHDRAWAL_IDEMPOTENCY_CONFLICT") return apiError(code, 409);
    logError("customer.withdrawal.submission_failed", error, { requestId, route: "/api/account/withdrawals" });
    return apiError("WITHDRAWAL_SUBMISSION_FAILED", 500);
  }
}
