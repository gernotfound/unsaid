import type { Metadata } from "next";
import Link from "next/link";
import {
  ensureCustomerProfile,
  getCustomerProfile,
  isFirebaseConfigured,
  listCustomerAddresses,
  listCustomerOrderFulfillment,
  listCustomerOrders,
  listCustomerReturns,
} from "@unsaid/db";
import { CustomerAuthPanel } from "../../../components/CustomerAuthPanel";
import { CustomerDashboard } from "../../../components/CustomerDashboard";
import { FEATURES } from "../../../lib/features";
import { isFirebaseClientConfigured } from "../../../lib/firebaseClient";
import { readCustomerSession } from "../../../server/customerSession";
import styles from "./AccountPage.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Area personale",
  description: "Area personale UNSAID per profilo, indirizzi, ordini, tracciamento e resi.",
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
    const [fulfillment, returns] = await Promise.all([
      listCustomerOrderFulfillment(session.uid, orders),
      listCustomerReturns(session.uid, orders),
    ]);
    account = { profile, addresses, orders, fulfillment, returns };
  }

  return (
    <main id="main" className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div>
            <p className="eyebrow">CLIENTE / IDENTITÀ</p>
            <h1>IL TUO<br /><span>UNSAID.</span></h1>
          </div>
          <div className={styles.side}>
            <strong>Un profilo personale sarà necessario per acquistare.</strong>
            <p>Salva i tuoi dati e gli indirizzi italiani. Prezzi, scorte, ordini, tracciamento e resi resteranno verificati dal sistema.</p>
          </div>
        </header>

        {!FEATURES.accountsRequested ? (
          <section className={styles.locked}>
            <strong>AREA PERSONALE / PRONTA, NON APERTA</strong>
            <p>L&apos;area personale è pronta ma la registrazione pubblica è ancora disattivata tramite un controllo di attivazione.</p>
          </section>
        ) : !FEATURES.customerAccountsEnabled ? (
          <section className={styles.locked}>
            <strong>AREA PERSONALE / BLOCCO LEGALE</strong>
            <p>La registrazione resta bloccata finché i dati minimi del titolare e il contatto privacy non sono configurati. Consulta l&apos;<Link href="/privacy">Informativa privacy</Link>.</p>
          </section>
        ) : !infrastructureReady ? (
          <section className={styles.locked}>
            <strong>AREA PERSONALE / AUTENTICAZIONE NON DISPONIBILE</strong>
            <p>L&apos;autenticazione Firebase non è completamente configurata per questa installazione. Nessuna registrazione viene aperta finché applicazione e server non sono pronti.</p>
          </section>
        ) : account && session ? (
          <CustomerDashboard
            profile={account.profile}
            addresses={account.addresses}
            orders={account.orders}
            fulfillment={account.fulfillment}
            returns={account.returns}
            returnsEnabled={FEATURES.returnsEnabled}
            returnsRequested={FEATURES.returnsRequested}
            emailVerified={session.emailVerified}
          />
        ) : (
          <CustomerAuthPanel />
        )}
      </div>
    </main>
  );
}
