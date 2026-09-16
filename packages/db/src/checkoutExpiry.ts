import { getAdminFirestore } from "./firebase";
import { releaseExpiredPendingOrder } from "./payments";

const CHECKOUT_ATTEMPTS_COLLECTION = "checkoutAttempts";

interface ExpiringCheckoutAttempt {
  customerId: string;
  orderId: string;
  status: "pending_payment" | "cancelled" | "paid" | "payment_review";
  expiresAt: string;
}

export interface CheckoutExpirySweepResult {
  scanned: number;
  released: number;
  failed: number;
}

export async function releaseExpiredCheckoutAttempts(limit = 25): Promise<CheckoutExpirySweepResult> {
  const maximum = Math.min(100, Math.max(1, Math.trunc(limit)));
  const snapshot = await getAdminFirestore()
    .collection(CHECKOUT_ATTEMPTS_COLLECTION)
    .where("status", "==", "pending_payment")
    .where("expiresAt", "<=", new Date().toISOString())
    .orderBy("expiresAt", "asc")
    .limit(maximum)
    .get();

  let released = 0;
  let failed = 0;

  for (const document of snapshot.docs) {
    const attempt = document.data() as ExpiringCheckoutAttempt;
    try {
      await releaseExpiredPendingOrder({ customerId: attempt.customerId, orderId: attempt.orderId });
      released += 1;
    } catch {
      failed += 1;
    }
  }

  return { scanned: snapshot.size, released, failed };
}
