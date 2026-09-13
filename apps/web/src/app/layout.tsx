import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND } from "@unsaid/domain";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s — ${BRAND.name}` },
  description: `${BRAND.tagline} ${BRAND.description}`,
  applicationName: BRAND.name,
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
