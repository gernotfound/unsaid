# UNSAID — Brand contract

## Name

**UNSAID**

## Tagline

**wear what you wouldn't say.**

## Idea

UNSAID è il posto per le frasi che normalmente restano non dette. Ogni prodotto parte da un testo e lo trasforma in un capo grafico da indossare.

## Positioning

- streetwear editoriale, non merch generico;
- ironico, provocatorio, assurdo o riflessivo a seconda della frase;
- catalogo ampio con art direction coerente;
- fotografia prodotto neutra e riconoscibile;
- il testo stampato deve seguire pieghe, volume e prospettiva reale del tessuto.

## Visual identity

La working identity usa due asset coordinati:

- **wordmark** — costruzione geometrica uppercase `UNSAID` con tagli/interruzioni intenzionali;
- **mark** — `U` tagliata all'interno di una silhouette quadrata arrotondata.

La marca primaria resta monocromatica. Sul sito dark viene resa in near-white (`#f8fafc`); rosa, ciano, viola, ambra e arancio restano segnali editoriali/UI e non devono diventare riempimenti arbitrari del logo principale.

Asset canonici:

- `/public/branding/unsaid-wordmark.svg`;
- `/public/branding/unsaid-mark.svg`;
- `/public/favicon.svg`.

Regole:

- non deformare il rapporto larghezza/altezza;
- niente glow, gradienti o ombre applicati al logo principale;
- non ridisegnare singole lettere;
- mantenere spazio libero sufficiente intorno a wordmark e mark;
- header e footer usano il wordmark; favicon/social card possono usare il mark compatto.

Le immagini decorative del logo usano `alt=""` quando il link/contesto possiede già un nome accessibile, per evitare annunci duplicati agli screen reader.

## Social sharing

`apps/web/src/app/opengraph-image.tsx` genera una social card PNG 1200×630 con mark, wordmark e informazioni sintetiche del brand. Next.js la espone come metadata Open Graph, usati anche dai link preview di WhatsApp/Facebook.

La root metadata definisce anche una card `summary_large_image` per Twitter/X.

In produzione `NEXT_PUBLIC_SITE_URL` deve essere l'origine HTTPS canonica del sito: serve a rendere assoluti e stabili gli URL metadata letti dai crawler esterni. Le piattaforme social possono conservare in cache una preview precedente anche dopo un aggiornamento del sito.

## Naming / trademark check

Questa è una **working commercial identity**, non il risultato di una trademark clearance. Prima del lancio commerciale va eseguita una verifica formale del nome e del marchio nei mercati e nelle classi merceologiche rilevanti.

Una prima ricerca pubblica mostra attività terze già attive che usano la parola **UNSAID**, incluse realtà fashion/apparel e jewellery. Il progetto quindi non deve assumere che la proprietà del repository o una grafica differente rendano automaticamente disponibile il nome come marchio.

## Technical naming

- repository: `gernotfound/unsaid`
- package scope: `@unsaid/*`
- database locale: `unsaid`
- object-storage bucket: `unsaid`
- URL brand slug: `unsaid`
- product public IDs: `UNS-0001`, `UNS-0002`, ...

## Rule

Il nome visualizzato all'utente è sempre **UNSAID**. La tagline canonica è sempre in minuscolo e termina con il punto: **wear what you wouldn't say.**
