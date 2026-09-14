import Link from "next/link";
import { BRAND } from "@unsaid/domain";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label={`${BRAND.name}, home`}>{BRAND.name}</Link>

        <div className="brand-signals" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>

        <nav className="main-nav" aria-label="Navigazione principale">
          <Link href="/shop">Archive</Link>
          <Link href="/#model-01">Model 01</Link>
          <Link href="/#manifesto">Manifesto</Link>
          <Link href="/account">Account</Link>
        </nav>

        <span className="header-cta" aria-disabled="true" title="Shop non ancora attivo">SHOP / SOON</span>
      </div>
    </header>
  );
}
