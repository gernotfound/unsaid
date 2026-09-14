import type { Metadata } from "next";
import { AnalyticsPreferences } from "../../../components/AnalyticsPreferences";
import { getLegalSettings } from "../../../lib/legal";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "Cookie e strumenti di tracciamento utilizzati da UNSAID.",
};

export default function CookiesPage() {
  const legal = getLegalSettings();

  return (
    <main id="main" className="legal-page">
      <p className="eyebrow">LEGAL / COOKIE</p>
      <h1>Cookie.</h1>
      <p className="legal-lede">
        UNSAID adotta un approccio privacy-by-default: gli strumenti analytics restano spenti finché non vengono
        accettati esplicitamente.
      </p>

      <section className="legal-section">
        <p className="legal-index">01</p>
        <div>
          <h2>Impostazione predefinita</h2>
          <p>
            Alla prima visita il sito usa solo ciò che è necessario per erogare il servizio e ricordare la scelta
            privacy. Nessun cookie Analytics viene attivato dal codice UNSAID prima del consenso.
          </p>
          <p>
            Puoi rifiutare dal banner oppure chiuderlo con la X: entrambe le azioni mantengono gli analytics
            disattivati senza limitare la navigazione.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">02</p>
        <div>
          <h2>Strumenti tecnici</h2>
          <div className="legal-table-wrap">
            <table className="legal-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Finalità</th>
                  <th>Durata</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>unsaid.analytics-consent.v2</code></td>
                  <td>Local storage</td>
                  <td>Ricordare accettazione o rifiuto degli analytics.</td>
                  <td>180 giorni</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Questa preferenza non serve a misurare il comportamento di navigazione e viene cancellata quando scegli
            di riaprire le preferenze.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">03</p>
        <div>
          <h2>Google Analytics</h2>
          {legal.analyticsConsentEnabled ? (
            <>
              <p>
                Se scegli “Accetta analytics”, il sito può attivare Google Analytics. La libreria può impostare
                cookie proprietari come <code>_ga</code> e <code>_ga_&lt;container-id&gt;</code>, normalmente usati
                per distinguere utenti e mantenere lo stato della sessione.
              </p>
              <div className="legal-table-wrap">
                <table className="legal-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Fornitore</th>
                      <th>Finalità</th>
                      <th>Scadenza predefinita</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>_ga</code></td>
                      <td>Google Analytics</td>
                      <td>Distinguere utenti pseudonimi.</td>
                      <td>2 anni</td>
                    </tr>
                    <tr>
                      <td><code>_ga_*</code></td>
                      <td>Google Analytics</td>
                      <td>Mantenere lo stato della sessione.</td>
                      <td>2 anni</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Queste durate sono valori predefiniti documentati da Google; la configurazione effettiva può essere
                modificata nel tempo. La conservazione dei dati lato Analytics è distinta dalla durata dei cookie e va
                impostata nella proprietà Google Analytics.
              </p>
            </>
          ) : (
            <p>
              Google Analytics è attualmente bloccato dalla configurazione legale del sito e non viene proposto nel
              banner. La sezione resta documentata per il momento in cui la funzione verrà abilitata.
            </p>
          )}
        </div>
      </section>

      <section className="legal-section" id="preferences">
        <p className="legal-index">04</p>
        <div>
          <h2>Cambiare idea</h2>
          <p>
            Se gli analytics sono attivi puoi revocare la scelta in qualsiasi momento. La revoca interrompe la
            raccolta tramite il modulo Analytics e il sito prova anche a rimuovere i cookie Analytics proprietari
            presenti sul dominio.
          </p>
          {legal.analyticsConsentEnabled ? (
            <AnalyticsPreferences />
          ) : (
            <p className="legal-inline-status">Analytics non attivo in questa configurazione.</p>
          )}
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">05</p>
        <div>
          <h2>Rinnovo della scelta</h2>
          <p>
            La preferenza viene considerata valida per 180 giorni. Il sito può chiedere nuovamente una scelta prima
            della scadenza se cambiano in modo sostanziale finalità, fornitori o strumenti di tracciamento.
          </p>
          <p className="legal-updated">Ultimo aggiornamento: 14 settembre 2026.</p>
        </div>
      </section>
    </main>
  );
}
