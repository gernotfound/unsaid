import { cookies } from "next/headers";
import { ensureCustomerProfile, getAdminAuth } from "@unsaid/db";
import type { AuthenticatedCustomer, CustomerSession } from "@unsaid/domain";

export const CUSTOMER_SESSION_COOKIE = "__session";
export const CUSTOMER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;
const RECENT_SIGN_IN_SECONDS = 60 * 5;

export class CustomerAuthError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "CustomerAuthError";
  }
}

function decodedCustomer(decoded: { uid: string; email?: string; email_verified?: boolean }): AuthenticatedCustomer {
  if (!decoded.email) throw new CustomerAuthError("EMAIL_REQUIRED");
  return {
    uid: decoded.uid,
    email: decoded.email,
    emailVerified: decoded.email_verified === true,
  };
}

export async function createCustomerSession(idToken: string, displayName?: string) {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken, true);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!decoded.auth_time || nowSeconds - decoded.auth_time > RECENT_SIGN_IN_SECONDS) {
    throw new CustomerAuthError("RECENT_SIGN_IN_REQUIRED");
  }

  const customer = decodedCustomer(decoded);
  await ensureCustomerProfile({
    ...customer,
    ...(displayName?.trim() ? { displayName: displayName.trim() } : {}),
  });

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: CUSTOMER_SESSION_MAX_AGE_SECONDS * 1000,
  });

  return { sessionCookie, customer };
}

export async function readCustomerSession(checkRevoked = false): Promise<CustomerSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, checkRevoked);
    const customer = decodedCustomer(decoded);
    return {
      ...customer,
      issuedAt: decoded.iat ?? 0,
      expiresAt: decoded.exp ?? 0,
    };
  } catch {
    return null;
  }
}

export async function requireCustomerSession(options: { verifiedEmail?: boolean; checkRevoked?: boolean } = {}) {
  const session = await readCustomerSession(options.checkRevoked ?? true);
  if (!session) throw new CustomerAuthError("AUTH_REQUIRED");
  if (options.verifiedEmail && !session.emailVerified) {
    throw new CustomerAuthError("EMAIL_NOT_VERIFIED");
  }
  return session;
}

export function customerSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
  };
}
