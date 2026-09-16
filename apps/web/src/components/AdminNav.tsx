import Link from "next/link";
import styles from "./AdminNav.module.css";

export function AdminNav({ active }: { active: "catalog" | "commerce" | "orders" | "fulfillment" }) {
  return (
    <nav className={styles.nav} aria-label="Sezioni amministrazione">
      <Link data-active={active === "catalog"} href="/admin">Catalog</Link>
      <Link data-active={active === "commerce"} href="/admin/commerce">Commerce</Link>
      <Link data-active={active === "orders"} href="/admin/orders">Orders</Link>
      <Link data-active={active === "fulfillment"} href="/admin/fulfillment">Fulfillment</Link>
    </nav>
  );
}
