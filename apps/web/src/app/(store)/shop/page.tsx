import type { Metadata } from "next";
import type { CatalogSort } from "@unsaid/catalog";
import { CatalogArchive } from "../../../components/CatalogArchive";
import { catalog } from "../../../server/catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Archive",
  description: "L'archivio pubblico UNSAID: T-shirt monocromatiche, statement fronte e retro.",
};

type ShopPageProps = {
  searchParams: Promise<{ cursor?: string; sort?: string }>;
};

function parseCursor(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const sort: CatalogSort = params.sort === "archive" ? "archive" : "newest";
  const cursor = parseCursor(params.cursor);
  const [stats, page] = await Promise.all([
    catalog.getStats(),
    catalog.list({ cursor, limit: 24, sort }),
  ]);

  return (
    <main id="main" className="shop-page">
      <header className="shop-intro">
        <p className="eyebrow">UNSAID / CONTINUOUS ARCHIVE</p>
        <h1>EVERYTHING<br />WE <span>WORE</span><br />OUT LOUD.</h1>
        <div className="shop-intro__side">
          <strong>{String(stats.public).padStart(2, "0")}</strong>
          <p>White and black garments. Front and back statements. One continuous archive.</p>
        </div>
      </header>

      <CatalogArchive records={page.items} total={stats.public} sort={sort} nextCursor={page.nextCursor} />
    </main>
  );
}
