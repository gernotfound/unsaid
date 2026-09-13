import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND } from "@unsaid/domain";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { assetPath } from "../lib/publicPath";
import "./styles.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: BRAND.name, template: `%s — ${BRAND.name}` },
  description: `${BRAND.tagline} ${BRAND.description}`,
  applicationName: BRAND.name,
  icons: { icon: assetPath("/favicon.svg") },
  openGraph: {
    type: "website",
    title: BRAND.name,
    description: BRAND.tagline,
    siteName: BRAND.name,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="it">
      <body>
        <a className="skip-link" href="#main">Vai al contenuto</a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
