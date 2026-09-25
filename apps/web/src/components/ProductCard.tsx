import Image from "next/image";
import Link from "next/link";
import { primaryAsset, primaryCopy, type CatalogRecord } from "@unsaid/catalog";

type Props = {
  record: CatalogRecord;
  priority?: boolean;
  sale?: { priceCents: number; available: number } | null;
};

const TONES = ["pink", "cyan", "violet", "amber", "orange"] as const;

function printLabel(record: CatalogRecord) {
  if (record.copy.front && record.copy.back) return "FRONTE / RETRO";
  return record.copy.back ? "STAMPA RETRO" : "STAMPA FRONTE";
}

export function ProductCard({ record, priority = false, sale = null }: Props) {
  const asset = primaryAsset(record, "card");
  const statement = primaryCopy(record);
  const tone = TONES[(record.sequence - 1) % TONES.length] ?? "pink";
  const saleLabel = !sale
    ? "ARCHIVIO"
    : sale.available < 1
      ? "ESAURITO"
      : `€${(sale.priceCents / 100).toFixed(2).replace(".", ",")}`;

  return (
    <article className={`archive-card archive-card--${tone}`}>
      <Link className="archive-card__media" href={`/product/${record.slug}`} aria-label={`Apri ${record.title}`}>
        {asset ? (
          <Image
            src={asset}
            alt={`Maglia ${record.title}, vista ${record.primaryView === "front" ? "frontale" : "posteriore"}`}
            fill
            priority={priority}
            unoptimized={asset.startsWith("http")}
            sizes="(max-width: 640px) 100vw, (max-width: 980px) 50vw, (max-width: 1320px) 33vw, 25vw"
          />
        ) : (
          <div className="archive-card__missing"><span>{record.id}</span><strong>{statement}</strong></div>
        )}
        <span className="archive-card__signal" aria-hidden="true" />
        <span className="archive-card__view">{printLabel(record)}</span>
      </Link>

      <div className="archive-card__meta">
        <div className="archive-card__topline">
          <span>{record.id}</span>
          <span>{record.garment.color}</span>
        </div>
        <h3><Link href={`/product/${record.slug}`}>{record.title}</Link></h3>
        <p>{statement}</p>
        <div className="archive-card__foot">
          <span>{record.garment.fit}</span>
          <span>{saleLabel}</span>
        </div>
      </div>
    </article>
  );
}
