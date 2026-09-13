import type { Metadata } from "next";
import { getCatalogStats, listPublicCatalog } from "@unsaid/db";
import { CatalogClient } from "../../../components/CatalogClient";
import { FEATURES } from "../../../lib/features";

export const metadata: Metadata = {
  title: "Archive",
  description: "L'archivio UNSAID: frasi, concept e t-shirt approvate. Lo shop non è ancora attivo.",
};

export default async function ShopPage() {
  const [stats, records] = await Promise.all([getCatalogStats(), listPublicCatalog()]);
  const empty = stats.public === 0;

  return (
    <main id="main" className="shop-page">
      <header className="shop-intro">
        <p className="eyebrow">PUBLIC ARCHIVE / {stats.public} RECORDS</p>
        <h1>EVERYTHING<br />WE <em>COULD</em> SAY.</h1>
        <p>
          {empty
            ? "L'archivio pubblico è in preparazione. Il catalogo di test è stato rimosso e qui entreranno solo le frasi reali selezionate per UNSAID."
            : `Un archivio vivo. I concept restano visibili mentre vengono disegnati; i render approvati sono predisposti per taglie e carrello, ma lo shop ${FEATURES.shopEnabled ? "è attivo" : "non è ancora attivo"}.`}
        </p>
      </header>
      <CatalogClient initialRecords={records} />
    </main>
  );
}
