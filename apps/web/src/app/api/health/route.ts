export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, service: "web", timestamp: new Date().toISOString() });
}
