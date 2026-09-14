import type { Metadata } from "next";
import { getCatalogStats, listPublicCatalog } from "@unsaid/db";
import { CatalogClient } from "../../../components/CatalogClient";
import { FEATURES } from "../../../lib/features";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Archive",
  description: "L'archivio pubblico UNSAID: t-shirt pubblicate con render approvati.",
};

export default async function ShopPage() {
  const [stats, records] = await Promise.all([getCatalogStats(), listPublicCatalog()]);
  return (
    <main id="main" className="shop-page">
      <header className="shop-intro">
        <p className="eyebrow">PUBLIC ARCHIVE / {stats.public} RECORDS</p>
        <h1>EVERYTHING<br />WE <em>COULD</em> SAY.</h1>
        <p>Qui entrano soltanto le maglie nello stato Pubblicata. Bozze e revisioni restano private nel control room; lo shop {FEATURES.shopEnabled ? "è attivo" : "non è ancora attivo"}.</p>
      </header>
      <CatalogClient initialRecords={records} />
    </main>
  );
}
