import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  route?: string;
  userId?: string;
  orderId?: string;
  [key: string]: unknown;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  return { message: String(error) };
}

export function createRequestId() {
  return randomUUID();
}

export function logEvent(level: LogLevel, event: string, context: LogContext = {}) {
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...context,
  });

  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}

export function logError(event: string, error: unknown, context: LogContext = {}) {
  logEvent("error", event, {
    ...context,
    error: normalizeError(error),
  });
}
