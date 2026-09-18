import {
  getCustomerCommerceExport,
  getCustomerProfile,
  listCustomerAddresses,
} from "@unsaid/db";
import { FEATURES } from "../../../../lib/features";
import { requireCustomerSession, CustomerAuthError } from "../../../../server/customerSession";
import { apiError } from "../../../../server/http";
import { createRequestId, logError } from "../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();
  if (!FEATURES.customerAccountsEnabled) return apiError("ACCOUNTS_DISABLED", 403);

  try {
    const session = await requireCustomerSession({ checkRevoked: true });
    const [profile, addresses, commerce] = await Promise.all([
      getCustomerProfile(session.uid),
      listCustomerAddresses(session.uid),
      getCustomerCommerceExport(session.uid),
    ]);

    const body = JSON.stringify({
      exportedAt: new Date().toISOString(),
      account: profile,
      emailVerified: session.emailVerified,
      addresses,
      orders: commerce.orders,
      fulfillment: commerce.fulfillment,
      returns: commerce.returns,
      withdrawals: commerce.withdrawals,
    }, null, 2);

    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="unsaid-account-${session.uid}.json"`,
        "cache-control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    if (error instanceof CustomerAuthError) return apiError(error.code, 401);
    logError("customer.export.failed", error, { requestId, route: "/api/account/export" });
    return apiError("EXPORT_FAILED", 500);
  }
}
