import type { Metadata } from "next";
import { ARCHIVE } from "@unsaid/catalog";
import { AdminNav } from "../../components/AdminNav";
import { AdminPanel } from "../../components/AdminPanel";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <AdminNav active="catalog" />
      <main id="main">
        <AdminPanel seedRecords={ARCHIVE} />
      </main>
    </>
  );
}
