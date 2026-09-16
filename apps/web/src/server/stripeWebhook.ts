import { createHmac, timingSafeEqual } from "node:crypto";

export interface StripeWebhookEvent {
  id: string;
  type: string;
  created?: number;
  livemode?: boolean;
  data: {
    object: Record<string, unknown>;
  };
}

export class StripeWebhookError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "StripeWebhookError";
  }
}

function signatures(header: string) {
  const timestamps: string[] = [];
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (!value) continue;
    if (key === "t") timestamps.push(value);
    if (key === "v1") v1.push(value.toLowerCase());
  }
  return { timestamps, v1 };
}

function safeHexEqual(leftHex: string, rightHex: string) {
  if (!/^[a-f0-9]{64}$/.test(leftHex) || !/^[a-f0-9]{64}$/.test(rightHex)) return false;
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  options: { toleranceSeconds?: number; nowMs?: number } = {},
): StripeWebhookEvent {
  if (!signatureHeader || !secret) throw new StripeWebhookError("STRIPE_SIGNATURE_MISSING");

  const parsed = signatures(signatureHeader);
  const timestampRaw = parsed.timestamps[0];
  const timestamp = timestampRaw ? Number(timestampRaw) : Number.NaN;
  if (!Number.isInteger(timestamp) || timestamp <= 0 || parsed.v1.length === 0) {
    throw new StripeWebhookError("STRIPE_SIGNATURE_INVALID");
  }

  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const tolerance = options.toleranceSeconds ?? 300;
  if (!Number.isInteger(tolerance) || tolerance < 0 || Math.abs(nowSeconds - timestamp) > tolerance) {
    throw new StripeWebhookError("STRIPE_SIGNATURE_EXPIRED");
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  if (!parsed.v1.some((candidate) => safeHexEqual(expected, candidate))) {
    throw new StripeWebhookError("STRIPE_SIGNATURE_INVALID");
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw new StripeWebhookError("STRIPE_EVENT_INVALID_JSON");
  }

  if (!event || typeof event !== "object") throw new StripeWebhookError("STRIPE_EVENT_INVALID");
  const record = event as Record<string, unknown>;
  const data = record.data;
  if (
    typeof record.id !== "string" ||
    typeof record.type !== "string" ||
    !data ||
    typeof data !== "object" ||
    !(data as Record<string, unknown>).object ||
    typeof (data as Record<string, unknown>).object !== "object"
  ) {
    throw new StripeWebhookError("STRIPE_EVENT_INVALID");
  }

  return event as StripeWebhookEvent;
}
