import { NextResponse } from "next/server";
import { isFirebaseConfigured } from "@unsaid/db";
import { FEATURES } from "../../../../lib/features";
import {
  CUSTOMER_SESSION_COOKIE,
  createCustomerSession,
  customerSessionCookieOptions,
  CustomerAuthError,
} from "../../../../server/customerSession";
import { apiError, rejectCrossOrigin } from "../../../../server/http";
import { createRequestId, logError, logEvent } from "../../../../server/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!FEATURES.customerAccountsEnabled) return apiError("ACCOUNTS_DISABLED", 403);
  if (!isFirebaseConfigured()) return apiError("AUTH_UNAVAILABLE", 503);

  try {
    const body = (await request.json()) as { idToken?: unknown; displayName?: unknown };
    if (typeof body.idToken !== "string" || body.idToken.length < 100) {
      return apiError("INVALID_ID_TOKEN");
    }
    const displayName = typeof body.displayName === "string" ? body.displayName.slice(0, 80) : undefined;
    const { sessionCookie, customer } = await createCustomerSession(body.idToken, displayName);
    const response = NextResponse.json({
      ok: true,
      email: customer.email,
      emailVerified: customer.emailVerified,
    });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, sessionCookie, customerSessionCookieOptions());
    logEvent("info", "customer.session.created", { requestId, userId: customer.uid, route: "/api/auth/session" });
    return response;
  } catch (error) {
    if (error instanceof CustomerAuthError) return apiError(error.code, 401);
    logError("customer.session.create_failed", error, { requestId, route: "/api/auth/session" });
    return apiError("AUTH_FAILED", 401);
  }
}

export async function DELETE(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
    ...customerSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
