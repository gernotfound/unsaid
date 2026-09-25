import Link from "next/link";

export function MobileDock() {
  return (
    <nav className="mobile-dock" aria-label="Navigazione mobile">
      <Link href="/">Inizio</Link>
      <Link href="/shop">Archivio</Link>
      <Link href="/cart">Carrello</Link>
      <Link href="/account">Profilo</Link>
    </nav>
  );
}
