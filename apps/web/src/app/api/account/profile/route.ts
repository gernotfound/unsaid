import { updateCustomerDisplayName } from "@unsaid/db";
import { FEATURES } from "../../../../lib/features";
import { requireCustomerSession, CustomerAuthError } from "../../../../server/customerSession";
import { apiError, rejectCrossOrigin } from "../../../../server/http";
import { createRequestId, logError } from "../../../../server/logger";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!FEATURES.customerAccountsEnabled) return apiError("ACCOUNTS_DISABLED", 403);

  try {
    const session = await requireCustomerSession({ checkRevoked: true });
    const body = (await request.json()) as { displayName?: unknown };
    if (typeof body.displayName !== "string") return apiError("INVALID_DISPLAY_NAME");
    await updateCustomerDisplayName(session.uid, body.displayName);
    return Response.json({ ok: true, displayName: body.displayName.trim() });
  } catch (error) {
    if (error instanceof CustomerAuthError) return apiError(error.code, 401);
    if (error instanceof Error && error.message === "INVALID_DISPLAY_NAME") {
      return apiError("INVALID_DISPLAY_NAME");
    }
    logError("customer.profile.update_failed", error, { requestId, route: "/api/account/profile" });
    return apiError("PROFILE_UPDATE_FAILED", 500);
  }
}
