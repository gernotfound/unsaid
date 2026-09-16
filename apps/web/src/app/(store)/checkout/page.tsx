import type { Metadata } from "next";
import {
  ensureCustomerProfile,
  getCustomerProfile,
  isFirebaseConfigured,
  listCustomerAddresses,
} from "@unsaid/db";
import { CheckoutPanel } from "../../../components/CheckoutPanel";
import { getCheckoutConfiguration } from "../../../lib/checkout";
import { FEATURES } from "../../../lib/features";
import { getPaymentConfiguration } from "../../../lib/payment";
import { readCustomerSession } from "../../../server/customerSession";
import styles from "./CheckoutPage.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Checkout UNSAID con account verificato, indirizzo italiano, prenotazione stock e pagamento hosted.",
};

export default async function CheckoutPage() {
  const configuration = getCheckoutConfiguration();
  const payment = getPaymentConfiguration();
  const session = FEATURES.customerAccountsEnabled && isFirebaseConfigured()
    ? await readCustomerSession(false)
    : null;

  let addresses = [] as Awaited<ReturnType<typeof listCustomerAddresses>>;
  let defaultAddressId: string | null = null;

  if (session) {
    let profile = await getCustomerProfile(session.uid);
    if (!profile) profile = await ensureCustomerProfile(session);
    addresses = await listCustomerAddresses(session.uid);
    defaultAddressId = profile.defaultShippingAddressId ?? null;
  }

  const sessionState = !session ? "missing" : session.emailVerified ? "ready" : "unverified";

  return (
    <main id="main" className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>UNSAID / CHECKOUT / SERVER VERIFIED</p>
            <h1>VERIFY.<br /><span>THEN PAY.</span></h1>
          </div>
          <p>Account, indirizzo, prezzo e stock vengono verificati dal server. L&apos;ordine prenota atomicamente lo stock; quando il payment gate è attivo, il pagamento prosegue su Stripe Checkout e viene confermato soltanto dal webhook firmato.</p>
        </header>

        <CheckoutPanel
          enabled={FEATURES.checkoutPreparationEnabled}
          paymentEnabled={FEATURES.paymentEnabled}
          paymentProblems={payment.problems}
          paymentSessionMinutes={payment.sessionMinutes}
          sessionState={sessionState}
          addresses={addresses}
          defaultAddressId={defaultAddressId}
          standardShippingCents={configuration.standardShippingCents}
          freeShippingThresholdCents={configuration.freeShippingThresholdCents}
          reservationMinutes={configuration.reservationMinutes}
          configurationProblems={configuration.problems}
        />
      </div>
    </main>
  );
}
