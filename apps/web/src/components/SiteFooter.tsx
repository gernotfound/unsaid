import Link from "next/link";
import { BRAND } from "@unsaid/domain";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__signal" aria-hidden="true"><span /><span /><span /><span /><span /></div>
      <div className="site-footer__main">
        <strong>{BRAND.name}</strong>
        <div>
          <p>{BRAND.tagline}</p>
          <nav aria-label="Link footer">
            <Link href="/shop">Archive</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Termini</Link>
          </nav>
        </div>
      </div>
      <p className="site-footer__note">Independent statement wear · monochrome garments / fluorescent world.</p>
    </footer>
  );
}
