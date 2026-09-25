import type { Metadata } from "next";
import { AnalyticsPreferences } from "../../../components/AnalyticsPreferences";
import { FEATURES } from "../../../lib/features";
import { getLegalSettings, publicLegalValue } from "../../../lib/legal";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Informativa privacy del sito UNSAID.",
};

export default function PrivacyPage() {
  const legal = getLegalSettings();

  return (
    <main id="main" className="legal-page">
      <p className="eyebrow">NOTE LEGALI / DATI PERSONALI</p>
      <h1>Privacy.</h1>
      <p className="legal-lede">
        Questa informativa descrive i trattamenti connessi alla navigazione e, quando abilitato, all&apos;account cliente UNSAID.
        Conferma ordine, pagamenti e comunicazioni periodiche restano disattivati nella configurazione attuale.
      </p>

      {!legal.privacyIdentityReady ? (
        <div className="legal-status legal-status--warning">
          <strong>PRE-LANCIO / DATI TITOLARE DA COMPLETARE</strong>
          <p>
            Nome/denominazione e contatto del titolare devono essere configurati prima di attivare analytics o
            registrazione cliente. I relativi controlli di attivazione restano chiusi finché questi dati non sono disponibili.
          </p>
        </div>
      ) : null}

      <section className="legal-section">
        <p className="legal-index">01</p>
        <div>
          <h2>Titolare del trattamento</h2>
          <dl className="legal-data">
            <div><dt>Titolare</dt><dd>{publicLegalValue(legal.controllerName)}</dd></div>
            <div><dt>Marchio</dt><dd>{legal.tradingName}</dd></div>
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
          <h2>Dati tecnici di navigazione</h2>
          <p>
            Per consegnare le pagine e proteggere il servizio, l&apos;infrastruttura di hosting può trattare dati tecnici
            generati dalle richieste HTTP, come indirizzo IP, data e ora, URL richiesto, agente utente, informazioni di rete
            e log di sicurezza. Questi dati non vengono utilizzati da UNSAID per creare profili pubblicitari propri.
          </p>
          <p>
            Il trattamento è collegato alla necessità di rendere disponibile, stabile e sicuro il servizio e prevenire
            abusi. I log sono conservati secondo criteri di necessità tecnica, sicurezza e tutela dei diritti,
            compatibilmente con configurazioni e termini dei fornitori utilizzati.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">03</p>
        <div>
          <h2>Profilo cliente</h2>
          {FEATURES.customerAccountsEnabled ? (
            <>
              <p>
                Se crei un profilo trattiamo l&apos;identificativo tecnico Firebase, indirizzo email, stato di verifica
                dell&apos;email, eventuale nome visualizzato e gli indirizzi di spedizione italiani che scegli di salvare.
                Le credenziali/password sono gestite da Firebase Authentication e non vengono memorizzate nel database
                applicativo UNSAID.
              </p>
              <p>
                Questi dati servono a registrare e autenticare l&apos;utente, gestire il profilo, preparare le funzionalità
                di acquisto richieste dall&apos;utente e proteggere l&apos;accesso alle informazioni personali. L&apos;email
                verificata sarà obbligatoria prima di un futuro checkout.
              </p>
              <p>
                La sessione applicativa usa un cookie HttpOnly verificabile dal server. Profilo, indirizzi e futuri
                ordini non sono leggibili direttamente dal browser tramite Firestore: le operazioni passano dal server.
              </p>
            </>
          ) : (
            <p>
              La funzionalità del profilo è predisposta tecnicamente ma la registrazione pubblica non è attiva in questa
              configurazione; il sito non raccoglie quindi dati di profilo o indirizzi cliente attraverso l&apos;area personale.
            </p>
          )}
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">04</p>
        <div>
          <h2>Statistiche facoltative</h2>
          {legal.analyticsConsentEnabled ? (
            <>
              <p>
                Google Analytics viene inizializzato soltanto dopo una scelta positiva dell&apos;utente. In assenza di
                consenso, o dopo il rifiuto, il modulo analytics non viene avviato dal sito. La scelta viene ricordata
                localmente per 180 giorni, salvo modifiche sostanziali alla configurazione o cancellazione dei dati del browser.
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
              Nella configurazione attuale le statistiche facoltative restano disattivate finché i dati identificativi
              minimi del titolare non vengono configurati. Non viene quindi richiesto alcun consenso per le statistiche.
            </p>
          )}
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">05</p>
        <div>
          <h2>Fornitori e destinatari</h2>
          <ul className="legal-list">
            <li><strong>Vercel</strong> — ospitalità web, CDN, distribuzione del sito e relativi servizi tecnici.</li>
            <li><strong>Google Firebase</strong> — banca dati applicativa, autenticazione amministrativa e, quando abilitata, autenticazione cliente.</li>
            <li><strong>Google Analytics</strong> — solo se l&apos;utente presta il consenso e la funzione è abilitata.</li>
          </ul>
          <p>
            I fornitori possono utilizzare sub-responsabili e trattare dati anche fuori dallo Spazio Economico Europeo
            secondo i meccanismi di trasferimento applicabili previsti dai rispettivi accordi sul trattamento dei dati.
            La configurazione effettiva dei fornitori va verificata prima del lancio commerciale.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">06</p>
        <div>
          <h2>Conservazione</h2>
          <p>
            UNSAID applica il principio di minimizzazione. I dati tecnici vengono mantenuti per il periodo necessario a
            erogare e proteggere il servizio. I dati del profilo vengono mantenuti finché il profilo resta attivo o per
            il tempo necessario a gestire richieste, sicurezza e obblighi applicabili. Quando verranno attivati gli ordini,
            alcuni dati documentali e fiscali potranno dover essere conservati anche dopo la chiusura del profilo nei
            limiti previsti dalla legge.
          </p>
          <p>
            La preferenza sulle statistiche salvata nel browser scade dopo 180 giorni. I dati di Google Analytics, quando la funzione è
            attiva, seguono la configurazione di conservazione della proprietà Google Analytics.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">07</p>
        <div>
          <h2>Diritti</h2>
          <p>
            Nei casi previsti dal GDPR puoi chiedere accesso, rettifica, cancellazione, limitazione del trattamento,
            portabilità e opporti al trattamento. Quando il trattamento si basa sul consenso, puoi revocarlo in qualsiasi
            momento senza pregiudicare la liceità del trattamento precedente alla revoca.
          </p>
          <p>
            Puoi inoltre proporre reclamo al Garante per la protezione dei dati personali. Per esercitare i diritti usa
            il contatto privacy indicato sopra. La gestione tecnica di esportazione/chiusura del profilo deve essere completata
            prima dell&apos;apertura commerciale definitiva.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">08</p>
        <div>
          <h2>Decisioni automatizzate e profilazione</h2>
          <p>
            Nella configurazione pubblica attuale UNSAID non adotta decisioni automatizzate che producano effetti
            giuridici o analogamente significativi sugli utenti e non utilizza i dati del profilo o di navigazione per
            profilazione pubblicitaria propria.
          </p>
        </div>
      </section>

      <section className="legal-section">
        <p className="legal-index">09</p>
        <div>
          <h2>Aggiornamenti</h2>
          <p>
            Questa informativa viene aggiornata quando cambiano finalità, fornitori o funzionalità. L&apos;attivazione di
            conferma ordine, pagamenti, comunicazioni periodiche o ulteriori strumenti promozionali richiederà un aggiornamento coerente con
            la configurazione realmente rilasciata.
          </p>
          <p className="legal-updated">Ultimo aggiornamento: 14 settembre 2026.</p>
        </div>
      </section>
    </main>
  );
}
