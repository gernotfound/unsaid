import type { Metadata } from "next";
import { ARCHIVE } from "@unsaid/catalog";
import { AdminPanel } from "../../components/AdminPanel";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main id="main">
      <AdminPanel seedRecords={ARCHIVE} />
    </main>
  );
}
