import type { Metadata } from "next";
import { AnalyticsPreferences } from "../../../components/AnalyticsPreferences";
import { getLegalSettings, publicLegalValue } from "../../../lib/legal";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Informativa privacy del sito UNSAID.",
};

export default function PrivacyPage() {
  const legal = getLegalSettings();

  return (
    <main id="main" className="legal-page">
      <p className="eyebrow">LEGAL / PRIVACY</p>
      <h1>Privacy.</h1>
      <p className="legal-lede">
        Questa informativa descrive i trattamenti connessi alla navigazione del sito UNSAID nella configurazione
        attuale di pre-lancio. Checkout, account cliente, newsletter e pagamenti non sono attivi.
      </p>

      {!legal.privacyIdentityReady ? (
        <div className="legal-status legal-status--warning">
          <strong>PRE-LAUNCH / DATI TITOLARE DA COMPLETARE</strong>
          <p>
            L&apos;infrastruttura privacy è predisposta, ma nome/denominazione e contatto del titolare devono essere
            configurati prima di attivare analytics o qualunque ulteriore raccolta di dati personali.
          </p>
        </div>
      ) : null}

      <section className="legal-section">
        <p className="legal-index">01</p>
        <div>
          <h2>Titolare del trattamento</h2>
          <dl className="legal-data">
            <div><dt>Titolare</dt><dd>{publicLegalValue(legal.controllerName)}</dd></div>
            <div><dt>Brand</dt><dd>{legal.tradingName}</dd></div>
            <div><dt>Contatto privacy</dt><dd>{publicLegalValue(legal.contactEmail)}</dd></div>
            <div><dt>Sede / indirizzo</dt><dd>{publicLegalValue(legal.registeredAddress)}</dd></div>
            <div><dt>Paese</dt><dd>{legal.country}</dd></div>
            {legal.dpoEmail ? <div><dt>DPO</dt><dd>{legal.dpoEmail}</dd></div> : null}
          </dl>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">02</p>
        <div>
          <h2>Dati trattati durante la navigazione</h2>
          <p>
            Per consegnare le pagine e proteggere il servizio, l&apos;infrastruttura di hosting può trattare dati
            tecnici generati dalle richieste HTTP, come indirizzo IP, data e ora, URL richiesto, user agent,
            informazioni di rete e log di sicurezza. Questi dati non vengono usati da UNSAID per creare profili
            commerciali degli utenti.
          </p>
          <p>
            La base giuridica è il legittimo interesse a rendere disponibile, stabile e sicuro il sito e a prevenire
            abusi. I log sono conservati secondo criteri di necessità tecnica, sicurezza e tutela dei diritti,
            compatibilmente con le configurazioni e i termini dei fornitori utilizzati.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">03</p>
        <div>
          <h2>Analytics opzionali</h2>
          {legal.analyticsConsentEnabled ? (
            <>
              <p>
                Google Analytics viene inizializzato soltanto dopo una scelta positiva dell&apos;utente. In assenza di
                consenso, o dopo il rifiuto, il modulo analytics non viene avviato dal sito. La scelta viene ricordata
                localmente per 180 giorni, salvo modifiche sostanziali alla configurazione o cancellazione dei dati
                del browser.
              </p>
              <p>
                Quando autorizzato, Analytics può trattare dati di utilizzo, informazioni sul dispositivo/browser,
                pagine visitate ed identificatori pseudonimi necessari alla misurazione configurata. La base giuridica
                è il consenso, revocabile in qualsiasi momento.
              </p>
              <AnalyticsPreferences />
            </>
          ) : (
            <p>
              Nella configurazione attuale gli analytics opzionali restano disattivati finché i dati identificativi
              minimi del titolare non vengono configurati. Nessun consenso analytics viene quindi richiesto.
            </p>
          )}
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">04</p>
        <div>
          <h2>Fornitori e destinatari</h2>
          <ul className="legal-list">
            <li><strong>Vercel</strong> — hosting, CDN, delivery del sito e relativi servizi tecnici.</li>
            <li><strong>Google Firebase</strong> — infrastruttura applicativa e autenticazione dell&apos;area amministrativa.</li>
            <li><strong>Google Analytics</strong> — solo se l&apos;utente presta il consenso e la funzione è abilitata.</li>
          </ul>
          <p>
            I fornitori possono utilizzare sub-responsabili e trattare dati anche fuori dallo Spazio Economico
            Europeo secondo i meccanismi di trasferimento applicabili previsti dai rispettivi accordi sul trattamento
            dei dati, inclusi, ove necessari, strumenti contrattuali riconosciuti dal GDPR.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">05</p>
        <div>
          <h2>Conservazione</h2>
          <p>
            UNSAID applica il principio di minimizzazione. I dati tecnici vengono mantenuti per il periodo necessario
            a erogare e proteggere il servizio o per adempiere ad obblighi legali e difendere diritti. La preferenza
            analytics salvata nel browser scade dopo 180 giorni. I dati Analytics, quando la funzione è attiva,
            seguono la configurazione di conservazione della proprietà Google Analytics e devono essere mantenuti al
            minimo coerente con le finalità statistiche.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">06</p>
        <div>
          <h2>Diritti</h2>
          <p>
            Nei casi previsti dal GDPR puoi chiedere accesso, rettifica, cancellazione, limitazione del trattamento,
            portabilità e opporti al trattamento. Quando il trattamento si basa sul consenso, puoi revocarlo in
            qualsiasi momento senza pregiudicare la liceità del trattamento precedente alla revoca.
          </p>
          <p>
            Puoi inoltre proporre reclamo al Garante per la protezione dei dati personali. Per esercitare i diritti
            usa il contatto privacy indicato sopra.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">07</p>
        <div>
          <h2>Decisioni automatizzate e profilazione</h2>
          <p>
            Nella configurazione pubblica attuale UNSAID non adotta decisioni automatizzate che producano effetti
            giuridici o analogamente significativi sugli utenti e non utilizza dati di navigazione per profilazione
            pubblicitaria propria.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">08</p>
        <div>
          <h2>Aggiornamenti</h2>
          <p>
            Questa informativa viene aggiornata quando cambiano finalità, fornitori o funzionalità. L&apos;attivazione
            di account cliente, newsletter, checkout, pagamenti o ulteriori strumenti di marketing richiederà un
            aggiornamento prima del rilascio della relativa funzione.
          </p>
          <p className="legal-updated">Ultimo aggiornamento: 14 settembre 2026.</p>
        </div>
      </section>
    </main>
  );
}
