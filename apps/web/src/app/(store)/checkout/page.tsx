import type { Metadata } from "next";
import {
  ensureCustomerProfile,
  getCustomerProfile,
  isFirebaseConfigured,
  listCustomerAddresses,
} from "@unsaid/db";
import { CheckoutPanel } from "../../../components/CheckoutPanel";
import { PaymentReturnStatus } from "../../../components/PaymentReturnStatus";
import { getCheckoutConfiguration } from "../../../lib/checkout";
import { FEATURES } from "../../../lib/features";
import { getPaymentConfiguration } from "../../../lib/payment";
import { readCustomerSession } from "../../../server/customerSession";
import styles from "./CheckoutPage.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conferma ordine",
  description: "Conferma ordine UNSAID con profilo verificato, indirizzo italiano, prenotazione scorte e pagamento sicuro.",
};

type CheckoutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const query = await searchParams;
  const returnMode = first(query.payment);
  const returnOrderId = first(query.order) ?? "";
  const validReturn = (returnMode === "success" || returnMode === "cancelled") &&
    /^ORD-[A-Za-z0-9_-]{16,80}$/.test(returnOrderId);

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
            <p className={styles.kicker}>UNSAID / ORDINE / VERIFICA SERVER</p>
            <h1>VERIFICA.<br /><span>POI PAGA.</span></h1>
          </div>
          <p>Profilo, indirizzo, prezzo e scorte vengono verificati dal server. L&apos;ordine prenota le scorte in modo atomico; quando il pagamento è attivo, si prosegue su Stripe e la conferma avviene soltanto tramite webhook firmato.</p>
        </header>

        {validReturn ? (
          <PaymentReturnStatus
            mode={returnMode}
            orderId={returnOrderId}
            paymentEnabled={FEATURES.paymentEnabled}
          />
        ) : (
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
        )}
      </div>
    </main>
  );
}
