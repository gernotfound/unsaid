import type { Metadata } from "next";
import { AnalyticsPreferences } from "../../../components/AnalyticsPreferences";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main id="main" className="legal-page">
      <p className="eyebrow">LEGAL / DRAFT</p>
      <h1>Privacy</h1>
      <p>
        UNSAID usa Google Analytics solo dopo un consenso esplicito. Se rifiuti, il sito continua a funzionare
        normalmente e il modulo Analytics non viene inizializzato. La preferenza viene salvata localmente nel browser.
      </p>
      <p>
        Questa è ancora una pagina operativa provvisoria: prima del lancio commerciale verrà completata con titolare,
        basi giuridiche, tempi di conservazione, fornitori effettivi e ogni trattamento aggiuntivo introdotto da account,
        pagamenti o newsletter.
      </p>
      <AnalyticsPreferences />
    </main>
  );
}
