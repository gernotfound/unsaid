import type { Metadata } from "next";
import { getLegalSettings } from "../../../lib/legal";

export const metadata: Metadata = {
  title: "Termini d'uso",
  description: "Termini d'uso del sito UNSAID nella fase di pre-lancio.",
};

export default function TermsPage() {
  const legal = getLegalSettings();

  return (
    <main id="main" className="legal-page">
      <p className="eyebrow">LEGAL / TERMS</p>
      <h1>Termini d&apos;uso.</h1>
      <p className="legal-lede">
        Queste condizioni regolano la semplice consultazione del sito durante il pre-lancio. Non sono ancora
        condizioni generali di vendita.
      </p>

      <div className="legal-status">
        <strong>SHOP STATUS / OFF</strong>
        <p>
          {legal.commerceIdentityReady
            ? "L'identità commerciale è configurata, ma la vendita resta disattivata finché il checkout non viene abilitato."
            : "La vendita resta disattivata finché identità commerciale e documentazione precontrattuale non sono complete."}
        </p>
      </div>

      <section className="legal-section">
        <p className="legal-index">01</p>
        <div>
          <h2>Oggetto</h2>
          <p>
            Il sito presenta il progetto UNSAID, il suo archivio editoriale e concept/prodotti in preparazione.
            L&apos;accesso alle pagine pubbliche non crea un rapporto contrattuale di acquisto.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">02</p>
        <div>
          <h2>Nessun ordine durante il pre-lancio</h2>
          <p>
            Finché il checkout è disattivato, selezioni di taglia, prezzi dimostrativi, pulsanti disabilitati o altre
            componenti dell&apos;interfaccia non permettono di inoltrare un ordine con obbligo di pagamento.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">03</p>
        <div>
          <h2>Contenuti e accuratezza</h2>
          <p>
            Immagini, colori, mockup, testi, disponibilità e dettagli di prodotto della fase di sviluppo possono
            cambiare prima della vendita. Le caratteristiche definitive dei beni saranno indicate nelle relative
            pagine prodotto quando lo shop sarà operativo.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">04</p>
        <div>
          <h2>Uso del sito</h2>
          <p>
            È vietato usare il sito in modo da comprometterne sicurezza, disponibilità o integrità, tentare accessi
            non autorizzati all&apos;area amministrativa, aggirare misure tecniche o utilizzare contenuti protetti oltre
            quanto consentito dalla legge.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">05</p>
        <div>
          <h2>Disponibilità</h2>
          <p>
            Durante il pre-lancio il servizio può essere modificato, sospeso o aggiornato. UNSAID adotta misure
            ragionevoli per mantenere il sito disponibile e sicuro, senza garantire l&apos;assenza assoluta di
            interruzioni o errori.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">06</p>
        <div>
          <h2>Prima dell&apos;apertura dello shop</h2>
          <p>
            Questi termini saranno sostituiti o integrati da condizioni generali di vendita complete prima di
            consentire ordini. Il sistema applicativo richiede inoltre un flag legale separato prima di considerare
            lo shop effettivamente abilitato.
          </p>
          <p className="legal-updated">Ultimo aggiornamento: 14 settembre 2026.</p>
        </div>
      </section>
    </main>
  );
}
