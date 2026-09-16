import type { Metadata } from "next";
import { AdminNav } from "../../../components/AdminNav";
import { AdminOrdersPanel } from "../../../components/AdminOrdersPanel";

export const metadata: Metadata = {
  title: "Admin Orders",
  robots: { index: false, follow: false },
};

export default function AdminOrdersPage() {
  return (
    <>
      <AdminNav active="orders" />
      <AdminOrdersPanel />
    </>
  );
}
