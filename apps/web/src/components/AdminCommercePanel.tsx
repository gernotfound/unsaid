"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  GARMENT_COLORS,
  GARMENT_SIZES,
  availableInventory,
  commerceSku,
  type GarmentColor,
  type GarmentSize,
  type InventorySnapshot,
  type SellableProduct,
  type SellableVariant,
} from "@unsaid/domain";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseClientApp, isFirebaseClientConfigured } from "../lib/firebaseClient";
import styles from "./AdminCommercePanel.module.css";

type CatalogSummary = {
  id: string;
  sequence: number;
  slug: string;
  title: string;
  status: string;
  garment: { fit: string; color: string };
  media: {
    front: { asset: string | null; state: string; isBlankBase: boolean };
    back: { asset: string | null; state: string; isBlankBase: boolean };
  };
};

type VariantState = { variant: SellableVariant; inventory: InventorySnapshot };
type CommerceItem = { catalog: CatalogSummary; sellable: SellableProduct | null; variants: VariantState[] };
type CommercePage = { items: CommerceItem[]; nextCursor: number | null };
type SizeDraft = { active: boolean; onHand: number };
type ProductDraft = {
  active: boolean;
  price: string;
  taxClass: string;
  garmentColor: GarmentColor;
  sizes: Record<GarmentSize, SizeDraft>;
};

function emptySizes(): Record<GarmentSize, SizeDraft> {
  return Object.fromEntries(GARMENT_SIZES.map((size) => [size, { active: false, onHand: 0 }])) as Record<GarmentSize, SizeDraft>;
}

function inferredColor(item: CommerceItem): GarmentColor {
  if (item.sellable?.garmentColor && GARMENT_COLORS.includes(item.sellable.garmentColor)) return item.sellable.garmentColor;
  const fromVariant = item.variants.find((entry) => entry.variant.active)?.variant.garmentColor;
  if (fromVariant && GARMENT_COLORS.includes(fromVariant)) return fromVariant;
  return /nero|black/i.test(item.catalog.garment.color) ? "black" : "white";
}

function draftFrom(item: CommerceItem): ProductDraft {
  const garmentColor = inferredColor(item);
  const sizes = emptySizes();
  for (const entry of item.variants) {
    if (entry.variant.garmentColor !== garmentColor) continue;
    sizes[entry.variant.size] = { active: entry.variant.active, onHand: entry.inventory.onHand };
  }
  return {
    active: item.sellable?.active ?? false,
    price: item.sellable ? (item.sellable.price.amountCents / 100).toFixed(2).replace(".", ",") : "",
    taxClass: item.sellable?.taxClass ?? "standard_it",
    garmentColor,
    sizes,
  };
}

function eurosToCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function errorMessage(code: string) {
  if (code === "ADMIN_FORBIDDEN") return "Questo account non è autorizzato come admin.";
  if (code === "ADMIN_AUTH_REQUIRED") return "Sessione admin scaduta. Accedi di nuovo.";
  if (code === "CATALOG_NOT_PUBLISHED") return "Per attivare la vendita, la maglia deve essere pubblicata nel catalogo.";
  if (code === "CATALOG_MEDIA_NOT_READY") return "Per attivare la vendita servono fronte e retro approvati.";
  if (code.startsWith("STOCK_BELOW_RESERVED:")) return "Lo stock non può scendere sotto la quantità già riservata.";
  if (code.includes("ACTIVE_PRODUCT_REQUIRES_PRICE")) return "Inserisci un prezzo maggiore di zero prima di attivare la vendita.";
  if (code.includes("ACTIVE_PRODUCT_REQUIRES_VARIANT")) return "Attiva almeno una taglia prima di attivare la vendita.";
  return code === "INTERNAL_ERROR" ? "Errore server. Riprova." : code;
}

async function apiRequest<T>(user: User, url: string, init: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "REQUEST_FAILED");
  return payload;
}

export function AdminCommercePanel() {
  const configured = isFirebaseClientConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<CommerceItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const selected = items.find((item) => item.catalog.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it");
    if (!query) return items;
    return items.filter((item) =>
      `${item.catalog.id} ${item.catalog.title} ${item.catalog.slug}`.toLocaleLowerCase("it").includes(query),
    );
  }, [items, search]);

  const metrics = useMemo(() => {
    let configuredCount = 0;
    let activeCount = 0;
    let totalOnHand = 0;
    let totalAvailable = 0;
    for (const item of items) {
      if (item.sellable) configuredCount += 1;
      if (item.sellable?.active) activeCount += 1;
      for (const entry of item.variants) {
        totalOnHand += entry.inventory.onHand;
        totalAvailable += availableInventory(entry.inventory);
      }
    }
    return { configuredCount, activeCount, totalOnHand, totalAvailable };
  }, [items]);

  async function load(targetUser: User, reset = true) {
    setBusy(true);
    setNotice("");
    try {
      const page = await apiRequest<CommercePage>(
        targetUser,
        `/api/admin/commerce${!reset && cursor != null ? `?cursor=${cursor}` : ""}`,
      );
      setItems((current) => reset ? page.items : [...current, ...page.items]);
      setCursor(page.nextCursor);
      if (reset) {
        const first = page.items[0] ?? null;
        setSelectedId(first?.catalog.id ?? null);
        setDraft(first ? draftFrom(first) : null);
      }
    } catch (error) {
      setNotice(errorMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!configured) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(getAuth(getFirebaseClientApp()), (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) void load(nextUser, true);
      else {
        setItems([]);
        setSelectedId(null);
        setDraft(null);
      }
    });
  }, [configured]);

  function select(item: CommerceItem) {
    setSelectedId(item.catalog.id);
    setDraft(draftFrom(item));
    setNotice("");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await signInWithEmailAndPassword(getAuth(getFirebaseClientApp()), email.trim(), password);
      setPassword("");
    } catch {
      setNotice("Email o password non corretti.");
      setBusy(false);
    }
  }

  async function save() {
    if (!user || !selected || !draft) return;
    const priceCents = eurosToCents(draft.price);
    if (priceCents == null) {
      setNotice("Prezzo non valido. Usa per esempio 39,00.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await apiRequest<{ ok: true }>(user, "/api/admin/commerce", {
        method: "PATCH",
        body: JSON.stringify({
          catalogId: selected.catalog.id,
          active: draft.active,
          priceCents,
          taxClass: draft.taxClass,
          garmentColor: draft.garmentColor,
          variants: GARMENT_SIZES.map((size) => ({ size, ...draft.sizes[size] })),
        }),
      });
      const selectedId = selected.catalog.id;
      await load(user, true);
      setNotice(`${selectedId} / configurazione commerce salvata.`);
    } catch (error) {
      setNotice(errorMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return <section className={styles.center}><p>Firebase Web SDK non configurato.</p></section>;
  }
  if (!authReady) return <section className={styles.center}><p>AUTH / CHECKING</p></section>;
  if (!user) {
    return (
      <section className={styles.center}>
        <form className={styles.login} onSubmit={login}>
          <p className={styles.kicker}>UNSAID / COMMERCE CONTROL</p>
          <h1>Admin.</h1>
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button disabled={busy}>{busy ? "Accesso…" : "Accedi"}</button>
          {notice ? <p className={styles.notice}>{notice}</p> : null}
        </form>
      </section>
    );
  }

  return (
    <section className={styles.shell}>
      <header className={styles.topbar}>
        <div><p className={styles.kicker}>UNSAID / COMMERCE</p><strong>SKU + inventory control</strong></div>
        <div className={styles.session}><span>{user.email}</span><button onClick={() => void signOut(getAuth(getFirebaseClientApp()))}>Esci</button></div>
      </header>

      <div className={styles.metrics}>
        <div><span>Loaded</span><strong>{items.length}</strong></div>
        <div><span>Configured</span><strong>{metrics.configuredCount}</strong></div>
        <div><span>Active</span><strong>{metrics.activeCount}</strong></div>
        <div><span>On hand</span><strong>{metrics.totalOnHand}</strong></div>
        <div><span>Available</span><strong>{metrics.totalAvailable}</strong></div>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <label className={styles.search}><span className="sr-only">Cerca prodotto</span><input type="search" placeholder="Cerca ID o titolo…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className={styles.list}>
            {filtered.map((item) => {
              const stock = item.variants.reduce((sum, entry) => sum + availableInventory(entry.inventory), 0);
              return (
                <button key={item.catalog.id} data-active={item.catalog.id === selectedId} onClick={() => select(item)}>
                  <span>{item.catalog.id} / {item.catalog.status}</span>
                  <strong>{item.catalog.title}</strong>
                  <small>{item.sellable?.active ? "SALE ACTIVE" : item.sellable ? "CONFIGURED" : "NOT CONFIGURED"} · {stock} available</small>
                </button>
              );
            })}
          </div>
          {cursor != null && !search ? <button className={styles.loadMore} disabled={busy} onClick={() => void load(user, false)}>Carica altri</button> : null}
        </aside>

        <main className={styles.editor}>
          {selected && draft ? (
            <>
              <div className={styles.editorHead}>
                <div><p className={styles.kicker}>{selected.catalog.id} / {selected.catalog.status}</p><h1>{selected.catalog.title}</h1></div>
                <label className={styles.saleToggle}>
                  <input type="checkbox" checked={draft.active} disabled={selected.catalog.status !== "published"} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
                  <span>{draft.active ? "SALE ACTIVE" : "SALE OFF"}</span>
                </label>
              </div>

              {selected.catalog.status !== "published" ? <div className={styles.warning}>Pubblica prima il record editoriale per poter attivare la vendita.</div> : null}

              <div className={styles.settingsGrid}>
                <label><span>Prezzo vendita / EUR</span><input inputMode="decimal" value={draft.price} placeholder="39,00" onChange={(event) => setDraft({ ...draft, price: event.target.value })} /></label>
                <label><span>Colore capo</span><select value={draft.garmentColor} onChange={(event) => setDraft({ ...draft, garmentColor: event.target.value as GarmentColor })}><option value="white">White</option><option value="black">Black</option></select></label>
                <label><span>Tax class</span><input value={draft.taxClass} maxLength={64} onChange={(event) => setDraft({ ...draft, taxClass: event.target.value })} /></label>
              </div>

              <section className={styles.inventory}>
                <div className={styles.sectionHead}><div><p className={styles.kicker}>VARIANTS / ITALY</p><h2>Taglie e stock</h2></div><p>Lo stock riservato è read-only e non può essere sovrascritto dall&apos;admin.</p></div>
                <div className={styles.variantTable} role="table" aria-label="Taglie e inventario">
                  <div className={styles.variantHeader} role="row"><span>Sell</span><span>Size</span><span>SKU</span><span>On hand</span><span>Reserved</span><span>Available</span></div>
                  {GARMENT_SIZES.map((size) => {
                    const current = draft.sizes[size];
                    const existing = selected.variants.find((entry) => entry.variant.size === size && entry.variant.garmentColor === draft.garmentColor);
                    const reserved = existing?.inventory.reserved ?? 0;
                    const available = Math.max(0, current.onHand - reserved);
                    return (
                      <div className={styles.variantRow} role="row" key={size}>
                        <label><span className="sr-only">Vendi taglia {size}</span><input type="checkbox" checked={current.active} onChange={(event) => setDraft({ ...draft, sizes: { ...draft.sizes, [size]: { ...current, active: event.target.checked } } })} /></label>
                        <strong>{size}</strong>
                        <code>{commerceSku(selected.catalog.id, draft.garmentColor, size)}</code>
                        <input aria-label={`Stock ${size}`} type="number" min={reserved} max={1000000} step={1} value={current.onHand} onChange={(event) => setDraft({ ...draft, sizes: { ...draft.sizes, [size]: { ...current, onHand: Math.max(0, Math.trunc(Number(event.target.value) || 0)) } } })} />
                        <span>{reserved}</span>
                        <span>{available}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className={styles.actions}>
                <button className={styles.save} disabled={busy} onClick={() => void save()}>{busy ? "Salvataggio…" : "Salva commerce"}</button>
                <span>Checkout e pagamenti restano disattivati.</span>
              </div>
            </>
          ) : <div className={styles.empty}>Nessun prodotto disponibile.</div>}
        </main>
      </div>
      {notice ? <div className={styles.toast} role="status">{notice}</div> : null}
    </section>
  );
}
