import { linkWithdrawalRefundCase, linkWithdrawalReturnCase } from "@unsaid/db";
import { AdminAuthError, requireAdminRequest } from "../../../../../server/adminAuth";
import { rejectCrossOrigin } from "../../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = { params: Promise<{ id: string }> };

function responseForError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return Response.json({ error: error.code }, { status: error.code === "ADMIN_FORBIDDEN" ? 403 : 401 });
  }
  const code = error instanceof Error ? error.message : "WITHDRAWAL_LINK_FAILED";
  if (/^INVALID_/.test(code)) return Response.json({ error: code }, { status: 400 });
  if (code === "WITHDRAWAL_NOTICE_NOT_FOUND" || code === "RETURN_CASE_NOT_FOUND" || code === "REFUND_CASE_NOT_FOUND") {
    return Response.json({ error: code }, { status: 404 });
  }
  if (
    code === "WITHDRAWAL_RETURN_MISMATCH" ||
    code === "WITHDRAWAL_RETURN_LINES_MISMATCH" ||
    code === "WITHDRAWAL_REFUND_MISMATCH" ||
    code === "RETURN_WITHDRAWAL_ALREADY_LINKED"
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
    let withdrawalNotice;

    if (action === "link_return") {
      withdrawalNotice = await linkWithdrawalReturnCase({
        withdrawalNoticeId: id,
        returnCaseId: typeof body.returnCaseId === "string" ? body.returnCaseId : "",
      });
    } else if (action === "link_refund") {
      withdrawalNotice = await linkWithdrawalRefundCase({
        withdrawalNoticeId: id,
        refundCaseId: typeof body.refundCaseId === "string" ? body.refundCaseId : "",
      });
    } else {
      return Response.json({ error: "INVALID_WITHDRAWAL_ACTION" }, { status: 400 });
    }

    logEvent("warn", "admin_withdrawal.linked", {
      requestId,
      route: "/api/admin/withdrawals/[id]",
      userId: admin.uid,
      withdrawalNoticeId: id,
      action,
    });
    return Response.json({ withdrawalNotice }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const known = responseForError(error);
    if (known) return known;
    logError("admin_withdrawal.link_failed", error, { requestId, route: "/api/admin/withdrawals/[id]" });
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
