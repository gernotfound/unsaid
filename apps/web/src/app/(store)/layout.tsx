import type { ReactNode } from "react";
import { AnalyticsConsent } from "../../components/AnalyticsConsent";
import { MobileDock } from "../../components/MobileDock";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";

export default function StoreLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <MobileDock />
      <AnalyticsConsent />
    </>
  );
}
