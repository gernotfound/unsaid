import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProductBySlug, listPublicCatalog } from "@unsaid/db";
import { CommerceControls } from "../../../../components/CommerceControls";
import { ProductGallery } from "../../../../components/ProductGallery";
import { FEATURES } from "../../../../lib/features";
import { assetPath } from "../../../../lib/publicPath";

type ProductPageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  const records = await listPublicCatalog();
  return records.map((record) => ({ slug: record.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.title,
    description: product.phrase || `Concept ${product.id} nell'archivio UNSAID`,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);
  if (!product) notFound();
  const ready = product.status === "ready" && Boolean(product.images.front);

  return (
    <main id="main" className="product-page">
      <Link className="back-link" href="/shop">← Torna all&apos;archivio</Link>
      <div className="product-detail">
        <div className="product-detail__media">
          {ready && product.images.front ? (
            <ProductGallery
              title={product.title}
              front={assetPath(product.images.front)}
              back={product.images.back ? assetPath(product.images.back) : null}
            />
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
          {ready && product.price ? (
            <>
              <CommerceControls
                productId={product.id}
                slug={product.slug}
                title={product.title}
                price={product.price}
                shopEnabled={FEATURES.shopEnabled}
              />
              <div className="product-state product-state--ready">
                <strong>Render approvato.</strong>
                <p>Fronte e retro sono asset separati. Lo shop resterà spento finché <code>NEXT_PUBLIC_SHOP_ENABLED</code> non verrà impostato a true.</p>
              </div>
            </>
          ) : (
            <div className="product-state"><strong>Concept archiviato.</strong><p>Prima della vendita servono art direction, rendering e approvazione finale.</p></div>
          )}
        </section>
      </div>
    </main>
  );
}
