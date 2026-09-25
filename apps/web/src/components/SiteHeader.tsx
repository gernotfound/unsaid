import Link from "next/link";
import { BRAND } from "@unsaid/domain";
import { CartIndicator } from "./CartIndicator";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label={`${BRAND.name}, pagina iniziale`}>
          <img
            src="/branding/unsaid-wordmark.svg"
            width={1323}
            height={237}
            alt=""
            decoding="async"
          />
        </Link>

        <div className="brand-signals" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>

        <nav className="main-nav" aria-label="Navigazione principale">
          <Link href="/shop">Archivio</Link>
          <Link href="/#model-01">Modello 01</Link>
          <Link href="/#manifesto">Manifesto</Link>
          <Link href="/account">Area personale</Link>
        </nav>

        <CartIndicator className="header-cta" />
      </div>
    </header>
  );
}
