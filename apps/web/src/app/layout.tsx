import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BRAND } from "@unsaid/domain";
import "./styles.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const socialDescription = `${BRAND.tagline} ${BRAND.description}`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05070b",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: BRAND.name, template: `%s — ${BRAND.name}` },
  description: socialDescription,
  applicationName: BRAND.name,
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "it_IT",
    url: "/",
    title: BRAND.name,
    description: socialDescription,
    siteName: BRAND.name,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: socialDescription,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="it">
      <body>
        <a className="skip-link" href="#main">Vai al contenuto</a>
        {children}
      </body>
    </html>
  );
}
