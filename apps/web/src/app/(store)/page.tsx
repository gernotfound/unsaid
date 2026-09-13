import { BRAND } from "@unsaid/domain";

export default function HomePage() {
  return (
    <main id="main" className="shell">
      <section className="hero">
        <p className="meta">UNSAID / archive 001</p>
        <h1>{BRAND.name}</h1>
        <p className="tagline">{BRAND.tagline}</p>
        <p className="lede">Un archivio di frasi da indossare. Il catalogo, i render e la piattaforma sono progettati per crescere senza perdere l'art direction.</p>
      </section>
    </main>
  );
}
