import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { primaryCopy } from "@unsaid/catalog";
import { getPublicProductBySlug } from "@unsaid/db";
import { CommerceControls } from "../../../../components/CommerceControls";
import { ProductGallery } from "../../../../components/ProductGallery";
import { FEATURES } from "../../../../lib/features";

type ProductPageProps = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);
  if (!product) return {};
  return { title: product.title, description: primaryCopy(product) };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);
  if (!product) notFound();

  const front = product.media.front.asset;
  const back = product.media.back.asset;
  if (!front || !back) notFound();
  const approved = product.media.front.state === "approved" && product.media.back.state === "approved";
  const price = product.priceCents == null ? null : product.priceCents / 100;

  return (
    <main id="main" className="product-page">
      <Link className="back-link" href="/shop">← Torna all&apos;archivio</Link>
      <div className="product-detail">
        <div className="product-detail__media"><ProductGallery title={product.title} front={front} back={back} initialView={product.primaryView} /></div>
        <section className="product-detail__copy">
          <p className="eyebrow">{product.id} / {product.category} / {product.language}</p>
          <h1>{product.title}</h1>
          <blockquote>
            {product.copy.front ? <><b>Fronte:</b> {product.copy.front}</> : <><b>Fronte:</b> senza stampa</>}
            <br /><br />
            {product.copy.back ? <><b>Retro:</b> {product.copy.back}</> : <><b>Retro:</b> senza stampa</>}
          </blockquote>
          {price != null ? <p className="detail-price">€{price.toFixed(2).replace(".", ",")}</p> : null}
          <dl className="spec-list">
            <div><dt>Fit</dt><dd>{product.garment.fit}</dd></div>
            <div><dt>Colore</dt><dd>{product.garment.color}</dd></div>
            <div><dt>Stampa</dt><dd>{product.copy.front && product.copy.back ? "fronte / retro" : product.copy.back ? "retro" : "fronte"}</dd></div>
            <div><dt>Contenuto</dt><dd>{product.audience}</dd></div>
          </dl>
          {approved && price != null ? (
            <CommerceControls productId={product.id} slug={product.slug} title={product.title} price={price} shopEnabled={FEATURES.shopEnabled} />
          ) : (
            <div className="product-state product-state--ready"><strong>Archivio pubblicato.</strong><p>La maglia è visibile; prezzo, carrello e checkout restano separati e disattivati finché non vengono configurati.</p></div>
          )}
        </section>
      </div>
    </main>
  );
}
