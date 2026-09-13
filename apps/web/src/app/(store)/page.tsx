import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@unsaid/domain";
import { getCatalogStats, listPublicCatalog } from "@unsaid/db";
import { assetPath } from "../../lib/publicPath";

export default async function HomePage() {
  const [stats, records] = await Promise.all([getCatalogStats(), listPublicCatalog()]);
  const featured = records.find((record) => record.status === "ready" && record.images.front);

  return (
    <main id="main">
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow">UNSAID / ARCHIVE 001</p>
          <h1>WEAR WHAT<br />YOU <span>WOULDN&apos;T</span><br />SAY.</h1>
          <p className="hero-tagline">{BRAND.tagline}</p>
          <p className="hero-lede">Frasi che normalmente restano nella tua testa. Qui diventano capi: diretti, strani, sporchi, romantici o completamente fuori contesto.</p>
          <div className="hero-actions">
            <Link className="button button--dark" href="/shop">Esplora l&apos;archivio</Link>
            {featured ? <Link className="text-link" href={`/product/${featured.slug}`}>Vedi {featured.id} ↗</Link> : null}
          </div>
        </div>
        <div className="home-hero__media">
          <span className="archive-stamp">UNS-0001 / READY</span>
          <Image src={assetPath("/products/UNS-0001/front.webp")} alt="T-shirt bianca UNSAID con la scritta FRONTE" width={900} height={1125} priority sizes="(max-width: 800px) 100vw, 44vw" />
          <span className="media-caption">front / approved render</span>
        </div>
      </section>

      <section className="stat-strip" aria-label="Stato archivio">
        <div><strong>{stats.total}</strong><span>idee archiviate</span></div>
        <div><strong>{stats.ready}</strong><span>render approvati</span></div>
        <div><strong>{stats.concepts}</strong><span>concept da lavorare</span></div>
        <div><strong>{stats.adult}</strong><span>concept 18+</span></div>
      </section>

      <section className="manifesto" id="manifesto">
        <p className="eyebrow">MANIFESTO / 01</p>
        <div className="manifesto__grid">
          <h2>THE THINGS<br />YOU DON&apos;T SAY<br /><em>out loud.</em></h2>
          <div className="manifesto__copy">
            <p>UNSAID nasce da una collezione personale di frasi accumulate negli anni. Non cerchiamo di renderle tutte educate, intelligenti o universali.</p>
            <p>Ogni frase diventa un progetto a sé: layout, fronte, retro, colore e rendering vengono decisi prima della pubblicazione. La maglietta non è un supporto neutro; è parte della battuta.</p>
            <Link className="text-link" href="/shop">Apri tutte le frasi ↗</Link>
          </div>
        </div>
      </section>

      <section className="process-section">
        <p className="eyebrow">FROM THOUGHT TO TEE</p>
        <div className="process-grid">
          <article><span>01</span><h3>Unsaid</h3><p>La frase entra nell&apos;archivio con un ID permanente.</p></article>
          <article><span>02</span><h3>Designed</h3><p>Decidiamo gerarchia, posizione, colore e fronte/retro.</p></article>
          <article><span>03</span><h3>Rendered</h3><p>Il testo segue davvero pieghe e volume del tessuto.</p></article>
          <article><span>04</span><h3>Worn</h3><p>Solo il render approvato può diventare prodotto.</p></article>
        </div>
      </section>
    </main>
  );
}
