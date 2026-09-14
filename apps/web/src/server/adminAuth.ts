import { getAdminAuth, getAdminFirestore } from "@unsaid/db";

const LEGACY_OWNER_UID = "bFMrDg5iAOcWQ9VZwCuBHDrS1nB3";

export class AdminAuthError extends Error {
  constructor(public readonly code: "ADMIN_AUTH_REQUIRED" | "ADMIN_FORBIDDEN") {
    super(code);
    this.name = "AdminAuthError";
  }
}

export async function requireAdminRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new AdminAuthError("ADMIN_AUTH_REQUIRED");

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(match[1], true);
  } catch {
    throw new AdminAuthError("ADMIN_AUTH_REQUIRED");
  }

  const ownerUid = process.env.ADMIN_OWNER_UID?.trim() || LEGACY_OWNER_UID;
  if (decoded.uid === ownerUid) {
    return { uid: decoded.uid, email: decoded.email ?? null, owner: true } as const;
  }

  const admin = await getAdminFirestore().collection("admins").doc(decoded.uid).get();
  if (!admin.exists) throw new AdminAuthError("ADMIN_FORBIDDEN");
  return { uid: decoded.uid, email: decoded.email ?? null, owner: false } as const;
}
