import type { Metadata } from "next";
import { getLegalSettings, publicLegalValue } from "../../../lib/legal";

export const metadata: Metadata = {
  title: "Note legali",
  description: "Informazioni legali e stato del servizio UNSAID.",
};

export default function LegalPage() {
  const legal = getLegalSettings();

  return (
    <main id="main" className="legal-page">
      <p className="eyebrow">LEGAL / IMPRINT</p>
      <h1>Note legali.</h1>
      <p className="legal-lede">
        Informazioni sul soggetto responsabile del sito e sullo stato operativo del progetto UNSAID.
      </p>

      {!legal.commerceIdentityReady ? (
        <div className="legal-status legal-status--warning">
          <strong>PRE-LAUNCH / NO CHECKOUT</strong>
          <p>
            Il sito è attualmente un archivio editoriale. La vendita resta tecnicamente e legalmente bloccata finché
            non vengono completati i dati del prestatore e le condizioni di vendita.
          </p>
        </div>
      ) : null}

      <section className="legal-section">
        <p className="legal-index">01</p>
        <div>
          <h2>Identità del prestatore</h2>
          <dl className="legal-data">
            <div><dt>Denominazione / nome</dt><dd>{publicLegalValue(legal.controllerName)}</dd></div>
            <div><dt>Nome commerciale</dt><dd>{legal.tradingName}</dd></div>
            <div><dt>Sede / indirizzo</dt><dd>{publicLegalValue(legal.registeredAddress)}</dd></div>
            <div><dt>Email</dt><dd>{publicLegalValue(legal.contactEmail)}</dd></div>
            <div><dt>Partita IVA</dt><dd>{publicLegalValue(legal.vatNumber)}</dd></div>
            {legal.fiscalCode ? <div><dt>Codice fiscale</dt><dd>{legal.fiscalCode}</dd></div> : null}
            {legal.rea ? <div><dt>REA</dt><dd>{legal.rea}</dd></div> : null}
            {legal.pec ? <div><dt>PEC</dt><dd>{legal.pec}</dd></div> : null}
            <div><dt>Paese</dt><dd>{legal.country}</dd></div>
          </dl>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">02</p>
        <div>
          <h2>Stato commerciale</h2>
          <p>
            Il checkout è disattivato. Le pagine prodotto e gli eventuali prezzi mostrati durante il pre-lancio hanno
            funzione editoriale/dimostrativa e non costituiscono un ordine accettabile attraverso il sito.
          </p>
          <p>
            Prima dell&apos;attivazione della vendita verranno pubblicate le informazioni precontrattuali applicabili,
            comprese condizioni di vendita, prezzi e imposte, spedizione, pagamenti, recesso, garanzia legale,
            gestione dei reclami e ogni altra informazione richiesta per la vendita a distanza.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">03</p>
        <div>
          <h2>Proprietà intellettuale</h2>
          <p>
            Marchio, art direction, interfaccia, fotografie, render, testi di prodotto e altri contenuti originali
            presenti sul sito sono protetti dalle norme applicabili sulla proprietà intellettuale e possono essere
            utilizzati solo nei limiti consentiti dalla legge o previa autorizzazione del rispettivo titolare.
          </p>
          <p>
            Materiali di terzi eventualmente utilizzati restano di proprietà dei rispettivi titolari e devono essere
            accompagnati dalle licenze o autorizzazioni necessarie prima della pubblicazione commerciale.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">04</p>
        <div>
          <h2>Contatti</h2>
          <p>
            Per comunicazioni relative al sito utilizza l&apos;indirizzo indicato nei dati del prestatore. Le richieste
            relative ai dati personali seguono invece le modalità indicate nella Privacy policy.
          </p>
          <p className="legal-updated">Ultimo aggiornamento: 14 settembre 2026.</p>
        </div>
      </section>
    </main>
  );
}
