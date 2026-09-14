import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@unsaid/domain";
import { primaryAsset, primaryCopy } from "@unsaid/catalog";
import { getCatalogStats, getFeaturedPublicProduct, listPublicCatalogPage } from "@unsaid/db";
import { ProductCard } from "../../components/ProductCard";

export const revalidate = 300;

export default async function HomePage() {
  const [stats, featured, latest] = await Promise.all([
    getCatalogStats(),
    getFeaturedPublicProduct(),
    listPublicCatalogPage({ limit: 4, sort: "newest" }),
  ]);

  const featuredAsset = featured ? primaryAsset(featured) : null;
  const featuredCopy = featured ? primaryCopy(featured) : null;

  return (
    <main id="main">
      <section className="ff-hero">
        <div className="ff-hero__copy">
          <p className="eyebrow">UNSAID / FASHION FLUO / MODEL 01</p>
          <h1>
            WEAR WHAT<br />
            <span>YOU WOULDN&apos;T</span><br />
            SAY.
          </h1>
          <p className="ff-hero__lede">{BRAND.tagline} Maglie monocromatiche, pensieri molto meno neutrali.</p>
          <div className="ff-hero__actions">
            <Link className="button button--signal" href="/shop">Open archive <span aria-hidden="true">↘</span></Link>
            {featured ? <Link className="text-link" href={`/product/${featured.slug}`}>Latest / {featured.id}</Link> : null}
          </div>
          <div className="ff-hero__micro">
            <span>{String(stats.public).padStart(2, "0")} published</span>
            <span>white / black garments</span>
            <span>front / back statements</span>
          </div>
        </div>

        <div className="ff-hero__visual" aria-label="UNSAID MODEL 01 con T-shirt bianca">
          <div className="ff-hero__frame">
            <Image
              src="/editorial/model-01-walk.webp"
              alt="UNSAID MODEL 01, bot umanoide con T-shirt bianca in studio"
              fill
              priority
              sizes="(max-width: 860px) 100vw, 50vw"
            />
          </div>
          <div className="ff-hero__model-tag">
            <span>MODEL / 01</span>
            <strong>SAME BODY.<br />DIFFERENT THOUGHT.</strong>
          </div>
          <span className="ff-hero__pink" aria-hidden="true" />
          <span className="ff-hero__cyan" aria-hidden="true" />
        </div>
      </section>

      <section className="signal-rail" aria-label="Colori UNSAID">
        <div className="signal-rail__pink"><span>PINK</span><strong>#F472B6</strong></div>
        <div className="signal-rail__cyan"><span>CYAN</span><strong>#22D3EE</strong></div>
        <div className="signal-rail__violet"><span>VIOLET</span><strong>#7C3AED</strong></div>
        <div className="signal-rail__amber"><span>AMBER</span><strong>#FBBF24</strong></div>
        <div className="signal-rail__orange"><span>ORANGE</span><strong>#EA580C</strong></div>
      </section>

      <section className="latest-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LATEST / PUBLIC ARCHIVE</p>
            <h2>THOUGHTS,<br />NOW WEARABLE.</h2>
          </div>
          <div className="section-heading__aside">
            <p>Il capo resta semplice. La frase cambia carattere, peso e posizione da una maglia all&apos;altra.</p>
            <Link className="text-link" href="/shop">See all {stats.public} pieces ↗</Link>
          </div>
        </div>
        {latest.items.length ? (
          <div className="archive-grid archive-grid--home">
            {latest.items.map((record) => <ProductCard key={record.id} record={record} />)}
          </div>
        ) : (
          <div className="archive-empty"><span>DROP / 00</span><strong>EMPTY<br />FOR NOW.</strong></div>
        )}
      </section>

      <section className="model-section" id="model-01">
        <div className="model-section__media">
          <Image
            src="/editorial/model-01-detail.webp"
            alt="Dettaglio di UNSAID MODEL 01 con T-shirt bianca"
            fill
            sizes="(max-width: 860px) 100vw, 55vw"
          />
          <span className="model-section__index">MODEL 01 / CANONICAL</span>
        </div>
        <div className="model-section__copy">
          <p className="eyebrow">THE MODEL DOESN&apos;T CHANGE</p>
          <h2>THE<br /><span>STATEMENT</span><br />DOES.</h2>
          <p>MODEL 01 è il volto senza volto di UNSAID: stessa anatomia e stessa silhouette in ogni uscita. Possono cambiare colorway, luce, posa e maglia. Non cambia il personaggio.</p>
          <dl className="model-specs">
            <div><dt>Garments</dt><dd>white / black</dd></div>
            <div><dt>Shell</dt><dd>variable colorway</dd></div>
            <div><dt>Identity</dt><dd>fixed</dd></div>
          </dl>
        </div>
      </section>

      <section className="featured-statement" aria-label="Prodotto in evidenza">
        <div className="featured-statement__copy">
          <p className="eyebrow">CURRENT STATEMENT</p>
          <h2>{featuredCopy ?? "SOME THINGS LOOK BETTER ON A T-SHIRT."}</h2>
          {featured ? <Link className="button button--dark-on-signal" href={`/product/${featured.slug}`}>View {featured.id} ↗</Link> : <Link className="button button--dark-on-signal" href="/shop">Archive ↗</Link>}
        </div>
        <div className="featured-statement__media">
          {featured && featuredAsset ? (
            <Image src={featuredAsset} alt={`T-shirt UNSAID ${featured.title}`} fill unoptimized={featuredAsset.startsWith("http")} sizes="(max-width: 860px) 100vw, 44vw" />
          ) : (
            <span>UNSAID / DROP 00</span>
          )}
        </div>
      </section>

      <section className="manifesto-v2" id="manifesto">
        <p className="eyebrow">MANIFESTO / 01</p>
        <div className="manifesto-v2__grid">
          <h2>DON&apos;T<br />EXPLAIN IT.<br /><span>WEAR IT.</span></h2>
          <div>
            <p>UNSAID raccoglie frasi che di solito restano in testa e le trasforma in oggetti semplici: una maglia, un fronte, un retro, una scelta tipografica.</p>
            <p>Il sito può essere rumoroso. Il prodotto no. Bianco o nero, e una frase che si prende lo spazio che le serve.</p>
            <Link className="text-link" href="/shop">Enter the archive ↗</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
