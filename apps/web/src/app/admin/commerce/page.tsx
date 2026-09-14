import type { Metadata } from "next";
import { AdminCommercePanel } from "../../../components/AdminCommercePanel";
import { AdminNav } from "../../../components/AdminNav";

export const metadata: Metadata = {
  title: "Admin Commerce",
  robots: { index: false, follow: false },
};

export default function AdminCommercePage() {
  return (
    <>
      <AdminNav active="commerce" />
      <AdminCommercePanel />
    </>
  );
}
