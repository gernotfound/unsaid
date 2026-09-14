import { NextResponse } from "next/server";

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function rejectCrossOrigin(request: Request) {
  if (isSameOriginRequest(request)) return null;
  return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
}

export function apiError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
