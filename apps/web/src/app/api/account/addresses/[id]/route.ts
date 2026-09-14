import {
  deleteCustomerAddress,
  setDefaultShippingAddress,
  updateCustomerAddress,
} from "@unsaid/db";
import type { CustomerAddressInput } from "@unsaid/domain";
import { FEATURES } from "../../../../../lib/features";
import { requireCustomerSession, CustomerAuthError } from "../../../../../server/customerSession";
import { apiError, rejectCrossOrigin } from "../../../../../server/http";
import { createRequestId, logError } from "../../../../../server/logger";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ id: string }> };

function stringField(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function addressInput(body: Record<string, unknown>): CustomerAddressInput {
  const line2 = stringField(body.line2, 120).trim();
  const phone = stringField(body.phone, 24).trim();
  return {
    label: stringField(body.label, 40),
    recipientName: stringField(body.recipientName, 100),
    line1: stringField(body.line1, 120),
    ...(line2 ? { line2 } : {}),
    city: stringField(body.city, 80),
    province: stringField(body.province, 2),
    postalCode: stringField(body.postalCode, 5),
    country: "IT",
    ...(phone ? { phone } : {}),
  };
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!FEATURES.customerAccountsEnabled) return apiError("ACCOUNTS_DISABLED", 403);

  try {
    const session = await requireCustomerSession({ checkRevoked: true });
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    if (body.action === "default") {
      await setDefaultShippingAddress(session.uid, id);
      return Response.json({ ok: true });
    }

    const address = await updateCustomerAddress(session.uid, id, addressInput(body));
    return Response.json({ ok: true, address });
  } catch (error) {
    if (error instanceof CustomerAuthError) return apiError(error.code, 401);
    if (error instanceof Error && error.message.startsWith("INVALID_ADDRESS:")) return apiError(error.message);
    if (error instanceof Error && error.message === "ADDRESS_NOT_FOUND") return apiError("ADDRESS_NOT_FOUND", 404);
    logError("customer.address.update_failed", error, { requestId, route: "/api/account/addresses/[id]" });
    return apiError("ADDRESS_UPDATE_FAILED", 500);
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const requestId = createRequestId();
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!FEATURES.customerAccountsEnabled) return apiError("ACCOUNTS_DISABLED", 403);

  try {
    const session = await requireCustomerSession({ checkRevoked: true });
    const { id } = await params;
    await deleteCustomerAddress(session.uid, id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof CustomerAuthError) return apiError(error.code, 401);
    logError("customer.address.delete_failed", error, { requestId, route: "/api/account/addresses/[id]" });
    return apiError("ADDRESS_DELETE_FAILED", 500);
  }
}
