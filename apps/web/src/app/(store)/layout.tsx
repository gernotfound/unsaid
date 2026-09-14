import type { ReactNode } from "react";
import { AnalyticsConsent } from "../../components/AnalyticsConsent";
import { MobileDock } from "../../components/MobileDock";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";
import { getLegalSettings } from "../../lib/legal";

export default function StoreLayout({ children }: Readonly<{ children: ReactNode }>) {
  const legal = getLegalSettings();

  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <MobileDock />
      <AnalyticsConsent enabled={legal.analyticsConsentEnabled} />
    </>
  );
}
