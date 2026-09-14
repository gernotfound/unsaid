import Link from "next/link";

export function MobileDock() {
  return (
    <nav className="mobile-dock" aria-label="Navigazione mobile">
      <Link href="/">Home</Link>
      <Link href="/shop">Archive</Link>
      <span aria-disabled="true">Drop 00 / soon</span>
    </nav>
  );
}
