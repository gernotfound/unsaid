import Link from "next/link";
import styles from "./AdminNav.module.css";

export function AdminNav({ active }: { active: "catalog" | "commerce" | "orders" | "fulfillment" | "refunds" | "returns" }) {
  return (
    <nav className={styles.nav} aria-label="Sezioni amministrazione">
      <Link data-active={active === "catalog"} href="/admin">Catalogo</Link>
      <Link data-active={active === "commerce"} href="/admin/commerce">Vendite</Link>
      <Link data-active={active === "orders"} href="/admin/orders">Ordini</Link>
      <Link data-active={active === "fulfillment"} href="/admin/fulfillment">Spedizioni</Link>
      <Link data-active={active === "returns"} href="/admin/returns">Resi</Link>
      <Link data-active={active === "refunds"} href="/admin/refunds">Rimborsi</Link>
    </nav>
  );
}
