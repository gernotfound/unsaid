import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { GARMENT_COLORS, GARMENT_SIZES, type CommerceConfigurationInput } from "@unsaid/domain";
import { listAdminCommercePage, saveAdminCommerceConfiguration } from "@unsaid/db";
import { AdminAuthError, requireAdminRequest } from "../../../../server/adminAuth";
import { logError, logEvent } from "../../../../server/logger";

export const dynamic = "force-dynamic";

function responseForError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.code }, { status: error.code === "ADMIN_FORBIDDEN" ? 403 : 401 });
  }
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "CATALOG_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
  if (message === "CATALOG_NOT_PUBLISHED" || message === "CATALOG_MEDIA_NOT_READY" || message.startsWith("STOCK_BELOW_RESERVED:")) {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  if (/INVALID_|REQUIRES_|VARIANTS_REQUIRED|DUPLICATE_SIZE/.test(message)) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  logError("admin_commerce_failed", error, { route: "/api/admin/commerce" });
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}

function parseInput(value: unknown): CommerceConfigurationInput {
  if (!value || typeof value !== "object") throw new Error("INVALID_PAYLOAD");
  const input = value as Record<string, unknown>;
  const garmentColor = String(input.garmentColor ?? "");
  if (!GARMENT_COLORS.includes(garmentColor as (typeof GARMENT_COLORS)[number])) throw new Error("INVALID_GARMENT_COLOR");
  if (!Array.isArray(input.variants)) throw new Error("VARIANTS_REQUIRED");

  const variants = input.variants.map((variant) => {
    if (!variant || typeof variant !== "object") throw new Error("INVALID_VARIANT");
    const record = variant as Record<string, unknown>;
    const size = String(record.size ?? "");
    if (!GARMENT_SIZES.includes(size as (typeof GARMENT_SIZES)[number])) throw new Error("INVALID_SIZE");
    return {
      size: size as (typeof GARMENT_SIZES)[number],
      active: record.active === true,
      onHand: Number(record.onHand),
    };
  });

  return {
    catalogId: String(input.catalogId ?? ""),
    active: input.active === true,
    priceCents: Number(input.priceCents),
    taxClass: String(input.taxClass ?? ""),
    garmentColor: garmentColor as (typeof GARMENT_COLORS)[number],
    variants,
  };
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdminRequest(request);
    const url = new URL(request.url);
    const cursorValue = url.searchParams.get("cursor");
    const cursor = cursorValue == null ? undefined : Number(cursorValue);
    if (cursorValue != null && (!Number.isInteger(cursor) || cursor! < 1)) throw new Error("INVALID_CURSOR");
    const page = await listAdminCommercePage({ ...(cursor == null ? {} : { afterSequence: cursor }), limit: 25 });
    logEvent("info", "admin_commerce_list", { route: "/api/admin/commerce", userId: admin.uid, count: page.items.length });
    return NextResponse.json(page, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return responseForError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdminRequest(request);
    const input = parseInput(await request.json());
    await saveAdminCommerceConfiguration(input);

    revalidatePath("/", "page");
    revalidatePath("/shop", "page");
    revalidatePath("/product/[slug]", "page");

    logEvent("info", "admin_commerce_saved", { route: "/api/admin/commerce", userId: admin.uid, catalogId: input.catalogId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return responseForError(error);
  }
}
