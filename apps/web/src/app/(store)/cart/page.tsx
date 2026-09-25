import type { Metadata } from "next";
import { CartPanel } from "../../../components/CartPanel";
import { FEATURES } from "../../../lib/features";
import styles from "./CartPage.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Carrello",
  description: "Carrello UNSAID con verifica server-side di prezzo e disponibilità.",
};

export default function CartPage() {
  return (
    <main id="main" className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>UNSAID / CARRELLO</p>
            <h1>TIENILO<br /><span>CON TE.</span></h1>
          </div>
          <p>Il browser ricorda soltanto SKU e quantità. Prezzo, prodotto vendibile e stock vengono ricontrollati dal server ogni volta che apri o modifichi il carrello.</p>
        </header>
        <CartPanel
          shopEnabled={FEATURES.shopEnabled}
          checkoutPreparationEnabled={FEATURES.checkoutPreparationEnabled}
        />
      </div>
    </main>
  );
}
