import Link from "next/link";
import { BRAND } from "@unsaid/domain";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <strong>{BRAND.name}</strong>
        <em>{BRAND.tagline}</em>
      </div>
      <div className="site-footer__links">
        <Link href="/shop">Shop</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Termini</Link>
      </div>
      <p className="site-footer__note">Independent streetwear archive · built to scale.</p>
    </footer>
  );
}
