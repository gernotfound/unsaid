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
  if (record.copy.front && record.copy.back) return "FRONT / BACK";
  return record.copy.back ? "BACK PRINT" : "FRONT PRINT";
}

export function ProductCard({ record, priority = false, sale = null }: Props) {
  const asset = primaryAsset(record);
  const statement = primaryCopy(record);
  const tone = TONES[(record.sequence - 1) % TONES.length] ?? "pink";
  const saleLabel = !sale
    ? "ARCHIVE"
    : sale.available < 1
      ? "SOLD OUT"
      : `€${(sale.priceCents / 100).toFixed(2).replace(".", ",")}`;
  const isRemoteAsset = asset?.startsWith("http") ?? false;

  return (
    <article className={`archive-card archive-card--${tone}`}>
      <Link className="archive-card__media" href={`/product/${record.slug}`} aria-label={`Apri ${record.title}`}>
        {asset ? (
          <Image
            src={asset}
            alt={`T-shirt ${record.title}, vista ${record.primaryView}`}
            fill
            priority={priority}
            unoptimized={isRemoteAsset}
            quality={isRemoteAsset ? undefined : 90}
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
