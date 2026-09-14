import Link from "next/link";
import type { CatalogRecord, CatalogSort } from "@unsaid/catalog";
import { ProductCard } from "./ProductCard";

type Props = {
  records: readonly CatalogRecord[];
  total: number;
  sort: CatalogSort;
  nextCursor?: number | undefined;
};

function archiveHref(sort: CatalogSort, cursor?: number) {
  const params = new URLSearchParams();
  if (sort === "archive") params.set("sort", "archive");
  if (cursor != null) params.set("cursor", String(cursor));
  const query = params.toString();
  return query ? `/shop?${query}` : "/shop";
}

export function CatalogArchive({ records, total, sort, nextCursor }: Props) {
  return (
    <section className="archive-shell" aria-labelledby="archive-heading">
      <div className="archive-toolbar">
        <div>
          <p className="eyebrow">PUBLIC ARCHIVE</p>
          <h2 id="archive-heading">{total} {total === 1 ? "PIECE" : "PIECES"}</h2>
        </div>
        <nav className="archive-sort" aria-label="Ordina archivio">
          <Link aria-current={sort === "newest" ? "page" : undefined} href="/shop">Newest</Link>
          <Link aria-current={sort === "archive" ? "page" : undefined} href="/shop?sort=archive">Archive order</Link>
        </nav>
      </div>

      {records.length ? (
        <div className="archive-grid">
          {records.map((record) => <ProductCard key={record.id} record={record} />)}
        </div>
      ) : (
        <div className="archive-empty">
          <span>ARCHIVE / 000</span>
          <strong>NOTHING<br />PUBLISHED.</strong>
          <p>Il prossimo pezzo apparirà qui quando sarà pronto.</p>
        </div>
      )}

      {nextCursor != null ? (
        <div className="archive-next">
          <Link href={archiveHref(sort, nextCursor)}>Load next 24 <span aria-hidden="true">↘</span></Link>
        </div>
      ) : null}
    </section>
  );
}
