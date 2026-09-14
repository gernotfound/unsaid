import { NextResponse } from "next/server";
import { releaseExpiredCheckoutAttempts } from "@unsaid/db";
import { createRequestId, logError, logEvent } from "../../../../server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const requestId = createRequestId();
  if (!authorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await releaseExpiredCheckoutAttempts(50);
    logEvent("info", "checkout_expiry_sweep", {
      requestId,
      route: "/api/internal/checkout-expirations",
      ...result,
    });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logError("checkout.expiry_sweep_failed", error, {
      requestId,
      route: "/api/internal/checkout-expirations",
    });
    return NextResponse.json({ error: "EXPIRY_SWEEP_FAILED" }, { status: 500 });
  }
}
