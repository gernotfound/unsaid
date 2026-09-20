import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { assetForView, primaryCopy } from "@unsaid/catalog";
import { getPublicCommerceState } from "@unsaid/db";
import { CommerceControls } from "../../../../components/CommerceControls";
import { ProductGallery } from "../../../../components/ProductGallery";
import { FEATURES } from "../../../../lib/features";
import { catalog } from "../../../../server/catalog";

type ProductPageProps = { params: Promise<{ slug: string }> };

const TONES = ["pink", "cyan", "violet", "amber", "orange"] as const;

export const revalidate = 300;

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await catalog.getBySlug(slug);
  if (!product) return {};
  return { title: product.title, description: primaryCopy(product) };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await catalog.getBySlug(slug);
  if (!product) notFound();

  const front = assetForView(product, "front", "detail");
  const back = assetForView(product, "back", "detail");
  if (!front || !back) notFound();

  const commerce = await getPublicCommerceState(product.id);
  const statement = primaryCopy(product);
  const printPlacement = product.copy.front && product.copy.back ? "front / back" : product.copy.back ? "back" : "front";
  const tone = TONES[(product.sequence - 1) % TONES.length] ?? "pink";
  const price = commerce ? commerce.price.amountCents / 100 : null;

  return (
    <main id="main" className="product-page" data-tone={tone}>
      <div className="product-page__nav">
        <Link className="back-link" href="/shop">← Archive</Link>
        <span>{product.id} / {product.garment.color}</span>
      </div>

      <div className="product-detail">
        <div className="product-detail__media">
          <ProductGallery title={product.title} front={front} back={back} initialView={product.primaryView} />
        </div>

        <section className="product-detail__copy">
          <p className="eyebrow">{product.id} / {product.category}</p>
          <h1>{product.title}</h1>
          <p className="product-statement">{statement}</p>

          {price != null ? (
            <p className="detail-price">€{price.toFixed(2).replace(".", ",")}</p>
          ) : (
            <p className="detail-price detail-price--archive">ARCHIVE PIECE</p>
          )}

          <dl className="spec-list">
            <div><dt>Garment</dt><dd>{product.garment.color}</dd></div>
            <div><dt>Fit</dt><dd>{product.garment.fit}</dd></div>
            <div><dt>Print</dt><dd>{printPlacement}</dd></div>
            <div><dt>Language</dt><dd>{product.language}</dd></div>
          </dl>

          <div className="copy-sheet">
            <div><span>FRONT</span><p>{product.copy.front ?? "—"}</p></div>
            <div><span>BACK</span><p>{product.copy.back ?? "—"}</p></div>
          </div>

          {commerce ? (
            <CommerceControls
              productId={product.id}
              garmentColor={commerce.garmentColor}
              variants={commerce.variants.map((variant) => ({
                variantId: variant.variantId,
                size: variant.size,
                available: variant.available,
              }))}
              shopEnabled={FEATURES.shopEnabled}
            />
          ) : (
            <div className="product-state">
              <strong>ARCHIVE / NOT FOR SALE.</strong>
              <p>Questo record non ha ancora una configurazione commerce attiva. Il prezzo editoriale non viene usato come prezzo di vendita.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
