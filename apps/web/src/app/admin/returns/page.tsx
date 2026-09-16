import type { Metadata } from "next";
import { AdminNav } from "../../../components/AdminNav";
import { AdminReturnsPanel } from "../../../components/AdminReturnsPanel";

export const metadata: Metadata = {
  title: "Admin Returns",
  robots: { index: false, follow: false },
};

export default function AdminReturnsPage() {
  return (
    <main>
      <AdminNav active="returns" />
      <AdminReturnsPanel />
    </main>
  );
}
