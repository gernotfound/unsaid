import Link from "next/link";

export function MobileDock() {
  return (
    <nav className="mobile-dock" aria-label="Navigazione mobile">
      <Link href="/">Home</Link>
      <Link href="/shop">Archive</Link>
      <Link href="/cart">Cart</Link>
      <Link href="/account">Account</Link>
    </nav>
  );
}
