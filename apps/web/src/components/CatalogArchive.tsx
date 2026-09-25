import Link from "next/link";
import type { CatalogRecord, CatalogSort } from "@unsaid/catalog";
import { ProductCard } from "./ProductCard";

type CommerceSummary = { priceCents: number; available: number };

type Props = {
  records: readonly CatalogRecord[];
  total: number;
  sort: CatalogSort;
  nextCursor?: number | undefined;
  commerceById?: Readonly<Record<string, CommerceSummary>>;
};

function archiveHref(sort: CatalogSort, cursor?: number) {
  const params = new URLSearchParams();
  if (sort === "archive") params.set("sort", "archive");
  if (cursor != null) params.set("cursor", String(cursor));
  const query = params.toString();
  return query ? `/shop?${query}` : "/shop";
}

export function CatalogArchive({ records, total, sort, nextCursor, commerceById = {} }: Props) {
  return (
    <section className="archive-shell" aria-labelledby="archive-heading">
      <div className="archive-toolbar">
        <div>
          <p className="eyebrow">ARCHIVIO PUBBLICO</p>
          <h2 id="archive-heading">{total} {total === 1 ? "PEZZO" : "PEZZI"}</h2>
        </div>
        <nav className="archive-sort" aria-label="Ordina archivio">
          <Link aria-current={sort === "newest" ? "page" : undefined} href="/shop">Più recenti</Link>
          <Link aria-current={sort === "archive" ? "page" : undefined} href="/shop?sort=archive">Ordine archivio</Link>
        </nav>
      </div>

      {records.length ? (
        <div className="archive-grid">
          {records.map((record) => <ProductCard key={record.id} record={record} sale={commerceById[record.id] ?? null} />)}
        </div>
      ) : (
        <div className="archive-empty">
          <span>ARCHIVIO / 000</span>
          <strong>NESSUN CONTENUTO<br />PUBBLICATO.</strong>
          <p>Il prossimo pezzo apparirà qui quando sarà pronto.</p>
        </div>
      )}

      {nextCursor != null ? (
        <div className="archive-next">
          <Link href={archiveHref(sort, nextCursor)}>Carica i prossimi 24 <span aria-hidden="true">↘</span></Link>
        </div>
      ) : null}
    </section>
  );
}
