import Link from "next/link";
import { BRAND } from "@unsaid/domain";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label={`${BRAND.name}, home`}>
          {BRAND.name}<span aria-hidden="true">.</span>
        </Link>
        <nav className="main-nav" aria-label="Navigazione principale">
          <Link href="/shop">Shop</Link>
          <Link href="/#manifesto">Manifesto</Link>
        </nav>
        <Link className="header-cta" href="/shop">Archive ↗</Link>
      </div>
    </header>
  );
}
