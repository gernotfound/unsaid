import type { Metadata } from "next";
import { AdminFulfillmentPanel } from "../../../components/AdminFulfillmentPanel";
import { AdminNav } from "../../../components/AdminNav";

export const metadata: Metadata = {
  title: "Admin Fulfillment",
  robots: { index: false, follow: false },
};

export default function AdminFulfillmentPage() {
  return (
    <>
      <AdminNav active="fulfillment" />
      <AdminFulfillmentPanel />
    </>
  );
}
