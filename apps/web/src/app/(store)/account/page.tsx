import type { Metadata } from "next";
import Link from "next/link";
import {
  ensureCustomerProfile,
  getCustomerProfile,
  isFirebaseConfigured,
  listCustomerAddresses,
  listCustomerOrderFulfillment,
  listCustomerOrders,
} from "@unsaid/db";
import { CustomerAuthPanel } from "../../../components/CustomerAuthPanel";
import { CustomerDashboard } from "../../../components/CustomerDashboard";
import { FEATURES } from "../../../lib/features";
import { isFirebaseClientConfigured } from "../../../lib/firebaseClient";
import { readCustomerSession } from "../../../server/customerSession";
import styles from "./AccountPage.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  description: "Account cliente UNSAID per profilo, indirizzi, ordini e tracking spedizioni.",
};

export default async function AccountPage() {
  const infrastructureReady = isFirebaseConfigured() && isFirebaseClientConfigured();
  const session = FEATURES.customerAccountsEnabled && infrastructureReady
    ? await readCustomerSession(false)
    : null;

  let account = null;
  if (session) {
    let profile = await getCustomerProfile(session.uid);
    if (!profile) profile = await ensureCustomerProfile(session);
    const [addresses, orders] = await Promise.all([
      listCustomerAddresses(session.uid),
      listCustomerOrders(session.uid, 25),
    ]);
    const fulfillment = await listCustomerOrderFulfillment(session.uid, orders);
    account = { profile, addresses, orders, fulfillment };
  }

  return (
    <main id="main" className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div>
            <p className="eyebrow">CUSTOMER / IDENTITY</p>
            <h1>YOUR<br /><span>UNSAID.</span></h1>
          </div>
          <div className={styles.side}>
            <strong>Un account sarà necessario per acquistare.</strong>
            <p>Salva i tuoi dati e gli indirizzi italiani. Prezzi, stock, ordini e tracking resteranno verificati dal server.</p>
          </div>
        </header>

        {!FEATURES.accountsRequested ? (
          <section className={styles.locked}>
            <strong>ACCOUNT / PREPARED, NOT OPEN</strong>
            <p>L&apos;infrastruttura account è pronta ma la registrazione pubblica è ancora disattivata tramite feature flag.</p>
          </section>
        ) : !FEATURES.customerAccountsEnabled ? (
          <section className={styles.locked}>
            <strong>ACCOUNT / LEGAL GATE</strong>
            <p>La registrazione resta bloccata finché i dati minimi del titolare e il contatto privacy non sono configurati. Consulta la <Link href="/privacy">Privacy policy</Link>.</p>
          </section>
        ) : !infrastructureReady ? (
          <section className={styles.locked}>
            <strong>ACCOUNT / AUTH UNAVAILABLE</strong>
            <p>Firebase Auth non è completamente configurato per questa installazione. Nessuna registrazione viene aperta finché client e server non sono pronti.</p>
          </section>
        ) : account && session ? (
          <CustomerDashboard
            profile={account.profile}
            addresses={account.addresses}
            orders={account.orders}
            fulfillment={account.fulfillment}
            emailVerified={session.emailVerified}
          />
        ) : (
          <CustomerAuthPanel />
        )}
      </div>
    </main>
  );
}
