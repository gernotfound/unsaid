import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@unsaid/domain";
import { primaryAsset, primaryCopy } from "@unsaid/catalog";
import { getPublicCommerceSummaries } from "@unsaid/db";
import { ProductCard } from "../../components/ProductCard";
import { catalog } from "../../server/catalog";

export const revalidate = 300;

export default async function HomePage() {
  const [stats, featured, latest] = await Promise.all([
    catalog.getStats(),
    catalog.getFeatured(),
    catalog.list({ limit: 4, sort: "newest" }),
  ]);
  const commerceById = await getPublicCommerceSummaries(latest.items.map((record) => record.id));

  const featuredAsset = featured ? primaryAsset(featured, "detail") : null;
  const featuredCopy = featured ? primaryCopy(featured) : null;

  return (
    <main id="main">
      <section className="ff-hero">
        <div className="ff-hero__copy">
          <p className="eyebrow">UNSAID / MODA FLUO / MODELLO 01</p>
          <h1>
            INDOSSA QUELLO<br />
            <span>CHE NON</span><br />
            DIRESTI.
          </h1>
          <p className="ff-hero__lede">{BRAND.tagline} Maglie monocromatiche, pensieri molto meno neutrali.</p>
          <div className="ff-hero__actions">
            <Link className="button button--signal" href="/shop">Apri archivio <span aria-hidden="true">↘</span></Link>
            {featured ? <Link className="text-link" href={`/product/${featured.slug}`}>Ultimo / {featured.id}</Link> : null}
          </div>
          <div className="ff-hero__micro">
            <span>{String(stats.public).padStart(2, "0")} pubblicati</span>
            <span>capi bianchi / neri</span>
            <span>archivio continuo</span>
          </div>
        </div>

        <div className="ff-hero__visual" aria-label="UNSAID MODELLO 01 con maglia bianca">
          <div className="ff-hero__frame">
            <Image
              src="/editorial/model-01-walk.webp"
              alt="UNSAID MODELLO 01, figura umanoide con maglia bianca in studio"
              fill
              priority
              sizes="(max-width: 860px) 100vw, 50vw"
            />
          </div>
          <div className="ff-hero__model-tag">
            <span>MODELLO / 01</span>
            <strong>STESSO CORPO.<br />PENSIERO DIVERSO.</strong>
          </div>
          <span className="ff-hero__pink" aria-hidden="true" />
          <span className="ff-hero__cyan" aria-hidden="true" />
        </div>
      </section>

      <section className="signal-rail" aria-label="Colori UNSAID">
        <div className="signal-rail__pink"><span>ROSA</span><strong>#F472B6</strong></div>
        <div className="signal-rail__cyan"><span>CIANO</span><strong>#22D3EE</strong></div>
        <div className="signal-rail__violet"><span>VIOLA</span><strong>#7C3AED</strong></div>
        <div className="signal-rail__amber"><span>AMBRA</span><strong>#FBBF24</strong></div>
        <div className="signal-rail__orange"><span>ARANCIONE</span><strong>#EA580C</strong></div>
      </section>

      <section className="latest-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ULTIMI / ARCHIVIO PUBBLICO</p>
            <h2>PENSIERI,<br />ORA INDOSSABILI.</h2>
          </div>
          <div className="section-heading__aside">
            <p>Il capo resta semplice. La frase cambia carattere, peso e posizione da una maglia all&apos;altra.</p>
            <Link className="text-link" href="/shop">Vedi tutti i {stats.public} pezzi ↗</Link>
          </div>
        </div>
        {latest.items.length ? (
          <div className="archive-grid archive-grid--home">
            {latest.items.map((record) => <ProductCard key={record.id} record={record} sale={commerceById[record.id] ?? null} />)}
          </div>
        ) : (
          <div className="archive-empty"><span>ARCHIVIO / VUOTO</span><strong>VUOTO<br />PER ORA.</strong></div>
        )}
      </section>

      <section className="model-section" id="model-01">
        <div className="model-section__media">
          <Image
            src="/editorial/model-01-detail.webp"
            alt="Dettaglio di UNSAID MODELLO 01 con maglia bianca"
            fill
            sizes="(max-width: 860px) 100vw, 55vw"
          />
          <span className="model-section__index">MODELLO 01 / CANONICO</span>
        </div>
        <div className="model-section__copy">
          <p className="eyebrow">IL MODELLO NON CAMBIA</p>
          <h2>LA<br /><span>FRASE</span><br />CAMBIA.</h2>
          <p>MODELLO 01 è il volto senza volto di UNSAID: stessa anatomia e stessa silhouette in ogni uscita. Possono cambiare colorazione, luce, posa e maglia. Non cambia il personaggio.</p>
          <dl className="model-specs">
            <div><dt>Capi</dt><dd>bianco / nero</dd></div>
            <div><dt>Scocca</dt><dd>colorazione variabile</dd></div>
            <div><dt>Identità</dt><dd>fissa</dd></div>
          </dl>
        </div>
      </section>

      <section className="featured-statement" aria-label="Prodotto in evidenza">
        <div className="featured-statement__copy">
          <p className="eyebrow">FRASE ATTUALE</p>
          <h2>{featuredCopy ?? "CERTE COSE STANNO MEGLIO SU UNA T-SHIRT."}</h2>
          {featured ? <Link className="button button--dark-on-signal" href={`/product/${featured.slug}`}>Vedi {featured.id} ↗</Link> : <Link className="button button--dark-on-signal" href="/shop">Archivio ↗</Link>}
        </div>
        <div className="featured-statement__media">
          {featured && featuredAsset ? (
            <Image src={featuredAsset} alt={`maglia UNSAID ${featured.title}`} fill unoptimized={featuredAsset.startsWith("http")} sizes="(max-width: 860px) 100vw, 44vw" />
          ) : (
            <span>UNSAID / ARCHIVIO</span>
          )}
        </div>
      </section>

      <section className="manifesto-v2" id="manifesto">
        <p className="eyebrow">MANIFESTO / 01</p>
        <div className="manifesto-v2__grid">
          <h2>NON<br />SPIEGARLO.<br /><span>INDOSSALO.</span></h2>
          <div>
            <p>UNSAID raccoglie frasi che di solito restano in testa e le trasforma in oggetti semplici: una maglia, un fronte, un retro, una scelta tipografica.</p>
            <p>Il sito può essere rumoroso. Il prodotto no. Bianco o nero, e una frase che si prende lo spazio che le serve.</p>
            <Link className="text-link" href="/shop">Entra nell&apos;archivio ↗</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
