import type { Metadata } from "next";
import { AdminNav } from "../../../components/AdminNav";
import { AdminRefundsPanel } from "../../../components/AdminRefundsPanel";

export const metadata: Metadata = {
  title: "Admin Refunds",
  robots: { index: false, follow: false },
};

export default function AdminRefundsPage() {
  return (
    <main>
      <AdminNav active="refunds" />
      <AdminRefundsPanel />
    </main>
  );
}
