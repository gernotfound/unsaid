import Link from "next/link";
import { BRAND } from "@unsaid/domain";
import { AnalyticsPreferences } from "./AnalyticsPreferences";
import { getLegalSettings } from "../lib/legal";

export function SiteFooter() {
  const legal = getLegalSettings();

  return (
    <footer className="site-footer">
      <div className="site-footer__signal" aria-hidden="true"><span /><span /><span /><span /><span /></div>
      <div className="site-footer__main">
        <Link className="site-footer__brand" href="/" aria-label={`${BRAND.name}, home`}>
          <img src="/branding/unsaid-wordmark.svg" width={1323} height={237} alt="" loading="lazy" />
        </Link>
        <div>
          <p>{BRAND.tagline}</p>
          <nav aria-label="Link footer">
            <Link href="/shop">Archive</Link>
            <Link href="/account">Account</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookies">Cookie</Link>
            <Link href="/legal">Note legali</Link>
            <Link href="/terms">Termini</Link>
          </nav>
          {legal.analyticsConsentEnabled ? (
            <AnalyticsPreferences className="site-footer__preference" label="Preferenze cookie" />
          ) : null}
        </div>
      </div>
      <p className="site-footer__note">
        {legal.commerceIdentityReady
          ? `${legal.tradingName} · ${legal.controllerName} · P.IVA ${legal.vatNumber}`
          : "Pre-launch · checkout disattivato."}
      </p>
    </footer>
  );
}
