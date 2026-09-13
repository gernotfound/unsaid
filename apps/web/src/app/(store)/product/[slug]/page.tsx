import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PUBLIC_ARCHIVE, findPublicProductBySlug } from "@unsaid/catalog";
import { ProductGallery } from "../../../../components/ProductGallery";

type ProductPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PUBLIC_ARCHIVE.map((record) => ({ slug: record.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = findPublicProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.title,
    description: product.phrase || `Concept ${product.id} nell'archivio UNSAID`,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = findPublicProductBySlug(slug);
  if (!product) notFound();
  const ready = product.status === "ready" && Boolean(product.images.front);

  return (
    <main id="main" className="product-page">
      <Link className="back-link" href="/shop">← Torna all&apos;archivio</Link>
      <div className="product-detail">
        <div className="product-detail__media">
          {ready && product.images.front ? (
            <ProductGallery title={product.title} front={product.images.front} back={product.images.back} />
          ) : (
            <div className="concept-detail">
              <span>{product.id} / {product.language.toUpperCase()}</span>
              <strong>{product.phrase}</strong>
              <small>{product.category} · render pending</small>
            </div>
          )}
        </div>
        <section className="product-detail__copy">
          <p className="eyebrow">{product.id} / {product.status} / {product.language}</p>
          <h1>{product.title}</h1>
          {product.phrase ? <blockquote>{product.phrase}{product.backPhrase ? <><br /><br /><b>Retro:</b> {product.backPhrase}</> : null}</blockquote> : null}
          {ready && product.price ? <p className="detail-price">€{product.price},00</p> : null}
          <dl className="spec-list">
            <div><dt>Fit</dt><dd>{product.fit}</dd></div>
            <div><dt>Colore</dt><dd>{product.color}</dd></div>
            <div><dt>Categoria</dt><dd>{product.category}</dd></div>
            <div><dt>Stato</dt><dd>{product.status}</dd></div>
          </dl>
          {ready ? (
            <div className="product-state product-state--ready"><strong>Render approvato.</strong><p>Fronte e retro sono asset separati. Il checkout verrà attivato quando collegheremo il commerce backend.</p></div>
          ) : (
            <div className="product-state"><strong>Concept archiviato.</strong><p>Prima della vendita servono art direction, rendering e approvazione finale.</p></div>
          )}
        </section>
      </div>
    </main>
  );
}
