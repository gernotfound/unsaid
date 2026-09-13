import type { Metadata } from "next";
import { PUBLIC_ARCHIVE, archiveStats } from "@unsaid/catalog";
import { CatalogClient } from "../../../components/CatalogClient";

export const metadata: Metadata = {
  title: "Shop",
  description: "L'archivio UNSAID: frasi, concept e t-shirt approvate.",
};

export const revalidate = 300;

export default function ShopPage() {
  const stats = archiveStats();

  return (
    <main id="main" className="shop-page">
      <header className="shop-intro">
        <p className="eyebrow">PUBLIC ARCHIVE / {stats.public} RECORDS</p>
        <h1>EVERYTHING<br />WE <em>COULD</em> SAY.</h1>
        <p>Un archivio vivo. I concept restano visibili mentre vengono disegnati; solo i prodotti con render approvato diventano acquistabili.</p>
      </header>
      <CatalogClient initialRecords={PUBLIC_ARCHIVE} />
    </main>
  );
}
