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
import { readCustomerSession } from "../../../server/customerSession";
import styles from "./CheckoutPage.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Checkout pre-payment UNSAID con account verificato, indirizzo italiano e prenotazione stock server-side.",
};

export default async function CheckoutPage() {
  const configuration = getCheckoutConfiguration();
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
            <p className={styles.kicker}>UNSAID / CHECKOUT / PRE-PAYMENT</p>
            <h1>VERIFY.<br /><span>THEN PAY.</span></h1>
          </div>
          <p>Account, indirizzo, prezzo e stock vengono verificati dal server. La preparazione crea un ordine pending e prenota atomicamente lo stock; il pagamento resta scollegato.</p>
        </header>

        <CheckoutPanel
          enabled={FEATURES.checkoutPreparationEnabled}
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
