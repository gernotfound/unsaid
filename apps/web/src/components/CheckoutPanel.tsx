"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CustomerAddress, Money, Order } from "@unsaid/domain";
import { readCart, type CartLine } from "../lib/cart";
import styles from "./CheckoutPanel.module.css";

type SessionState = "missing" | "unverified" | "ready";

type ValidatedLine = {
  variantId: string;
  catalogId: string;
  slug: string;
  title: string;
  size: string;
  garmentColor: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  available: number;
  image: string | null;
};

type ValidationResponse = {
  lines: ValidatedLine[];
  issues: Array<{ variantId: string; reason: string; available?: number }>;
  subtotal: Money;
  error?: string;
};

type PrepareResponse = {
  order: Order;
  paymentEnabled: false;
  error?: string;
};

type Props = {
  enabled: boolean;
  sessionState: SessionState;
  addresses: readonly CustomerAddress[];
  defaultAddressId: string | null;
  standardShippingCents: number | null;
  freeShippingThresholdCents: number | null;
  reservationMinutes: number;
  configurationProblems: readonly string[];
};

function formatMoney(money: Money | { amountCents: number; currency: "EUR" }) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: money.currency }).format(money.amountCents / 100);
}

function newIdempotencyKey() {
  return globalThis.crypto.randomUUID();
}

function errorLabel(code: string) {
  if (code === "AUTH_REQUIRED") return "Accedi al tuo account prima di continuare.";
  if (code === "EMAIL_NOT_VERIFIED") return "Verifica l'email prima di preparare l'ordine.";
  if (code === "ADDRESS_NOT_FOUND" || code === "INVALID_SHIPPING_ADDRESS") return "L'indirizzo selezionato non è più disponibile o non è valido.";
  if (code.startsWith("OUT_OF_STOCK:")) return "Lo stock è cambiato. Torna al carrello e ricontrolla le quantità.";
  if (code.startsWith("VARIANT_UNAVAILABLE:") || code.startsWith("PRODUCT_UNAVAILABLE:")) return "Un articolo non è più disponibile alla vendita.";
  if (code === "CHECKOUT_DISABLED" || code === "CHECKOUT_CONFIGURATION_INCOMPLETE") return "Il checkout non è ancora abilitato per questa installazione.";
  if (code === "IDEMPOTENCY_CONFLICT") return "La richiesta di checkout non è coerente con il tentativo precedente. Ricarica la pagina.";
  return "Impossibile preparare l'ordine. Riprova.";
}

export function CheckoutPanel({
  enabled,
  sessionState,
  addresses,
  defaultAddressId,
  standardShippingCents,
  freeShippingThresholdCents,
  reservationMinutes,
  configurationProblems,
}: Props) {
  const [localLines, setLocalLines] = useState<CartLine[]>([]);
  const [validated, setValidated] = useState<ValidationResponse | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState(defaultAddressId ?? addresses[0]?.id ?? "");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [prepared, setPrepared] = useState<Order | null>(null);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");

  const validateCart = useCallback(async () => {
    const lines = readCart();
    setLocalLines(lines);
    if (!lines.length) {
      setValidated(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/cart/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines: lines.map(({ variantId, quantity }) => ({ variantId, quantity })) }),
        cache: "no-store",
      });
      const payload = (await response.json()) as ValidationResponse;
      if (!response.ok) throw new Error(payload.error ?? "CART_VALIDATION_FAILED");
      setValidated(payload);
    } catch {
      setValidated(null);
      setNotice("Impossibile verificare il carrello con il server.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setIdempotencyKey(newIdempotencyKey());
    void validateCart();
  }, [validateCart]);

  const shippingPreviewCents = useMemo(() => {
    if (!validated || standardShippingCents == null) return null;
    if (freeShippingThresholdCents != null && validated.subtotal.amountCents >= freeShippingThresholdCents) return 0;
    return standardShippingCents;
  }, [freeShippingThresholdCents, standardShippingCents, validated]);

  const cartReady = Boolean(
    validated &&
    localLines.length > 0 &&
    validated.lines.length === localLines.length &&
    validated.issues.length === 0,
  );
  const canPrepare = enabled && sessionState === "ready" && Boolean(selectedAddressId) && cartReady && Boolean(idempotencyKey) && !prepared;

  async function prepare() {
    if (!canPrepare) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/checkout/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          addressId: selectedAddressId,
          idempotencyKey,
          lines: localLines.map(({ variantId, quantity }) => ({ variantId, quantity })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as PrepareResponse;
      if (!response.ok) throw new Error(payload.error ?? "CHECKOUT_PREPARE_FAILED");
      setPrepared(payload.order);
    } catch (error) {
      setNotice(errorLabel(error instanceof Error ? error.message : String(error)));
      await validateCart();
    } finally {
      setBusy(false);
    }
  }

  async function cancelPreparedOrder() {
    if (!prepared || prepared.status !== "pending_payment") return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/checkout/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: prepared.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { order?: Order; error?: string };
      if (!response.ok || !payload.order) throw new Error(payload.error ?? "CHECKOUT_CANCEL_FAILED");
      setPrepared(payload.order);
      setIdempotencyKey(newIdempotencyKey());
      await validateCart();
    } catch {
      setNotice("Impossibile annullare la preparazione dell'ordine. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  if (!localLines.length && !busy) {
    return (
      <section className={styles.blocked}>
        <strong>CART / EMPTY</strong>
        <p>Aggiungi almeno una maglia prima di entrare nel checkout.</p>
        <Link href="/shop">Torna all&apos;archive →</Link>
      </section>
    );
  }

  if (prepared) {
    const expires = prepared.reservationExpiresAt ? new Date(prepared.reservationExpiresAt) : null;
    return (
      <section className={styles.prepared}>
        <p className={styles.kicker}>ORDER / {prepared.status}</p>
        <h2>{prepared.id}</h2>
        <div className={styles.totalRow}><span>Totale</span><strong>{formatMoney(prepared.totals.total)}</strong></div>
        <p>
          {prepared.status === "pending_payment"
            ? `Stock prenotato${expires ? ` fino alle ${expires.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : ""}.`
            : "Prenotazione annullata e stock rilasciato."}
        </p>
        <div className={styles.paymentGate}>
          <strong>PAYMENT / NOT CONNECTED</strong>
          <span>L&apos;ordine pre-payment esiste, ma nessun addebito può partire: Stripe è ancora scollegato.</span>
        </div>
        {prepared.status === "pending_payment" ? (
          <button type="button" disabled={busy} onClick={() => void cancelPreparedOrder()}>Annulla preparazione e rilascia stock</button>
        ) : (
          <Link href="/cart">Torna al carrello →</Link>
        )}
        {notice ? <p className={styles.problem}>{notice}</p> : null}
      </section>
    );
  }

  return (
    <div className={styles.grid}>
      <section className={styles.main}>
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>01 / CART SERVER CHECK</p>
          <strong>{validated ? `${validated.lines.length} linee validate` : "Verifica in corso"}</strong>
        </div>
        <div className={styles.lines}>
          {(validated?.lines ?? []).map((line) => (
            <article key={line.variantId}>
              <div><span>{line.catalogId} / {line.size}</span><strong>{line.title}</strong></div>
              <span>{line.quantity} × {formatMoney(line.unitPrice)}</span>
              <strong>{formatMoney(line.lineTotal)}</strong>
            </article>
          ))}
        </div>
        {validated?.issues.length ? <p className={styles.problem}>Il carrello contiene righe non più valide. Torna al carrello per correggerle.</p> : null}

        <div className={styles.sectionHead}>
          <p className={styles.kicker}>02 / SHIPPING ADDRESS</p>
          <strong>Italia soltanto</strong>
        </div>
        {sessionState === "missing" ? (
          <div className={styles.blocked}><strong>ACCOUNT REQUIRED</strong><p>Devi accedere prima del checkout.</p><Link href="/account">Accedi / crea account →</Link></div>
        ) : sessionState === "unverified" ? (
          <div className={styles.blocked}><strong>EMAIL VERIFICATION REQUIRED</strong><p>Verifica l&apos;email e aggiorna la sessione dall&apos;area account.</p><Link href="/account">Apri account →</Link></div>
        ) : addresses.length ? (
          <div className={styles.addresses}>
            {addresses.map((address) => (
              <label key={address.id} data-selected={selectedAddressId === address.id ? "true" : "false"}>
                <input type="radio" name="shippingAddress" value={address.id} checked={selectedAddressId === address.id} onChange={() => setSelectedAddressId(address.id)} />
                <span><strong>{address.label}</strong>{address.recipientName}<br />{address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />{address.postalCode} {address.city} ({address.province})</span>
              </label>
            ))}
            <Link href="/account">Gestisci indirizzi →</Link>
          </div>
        ) : (
          <div className={styles.blocked}><strong>SHIPPING ADDRESS REQUIRED</strong><p>Salva almeno un indirizzo italiano nell&apos;account.</p><Link href="/account">Aggiungi indirizzo →</Link></div>
        )}
      </section>

      <aside className={styles.summary}>
        <p className={styles.kicker}>03 / AUTHORITATIVE SUMMARY</p>
        <dl>
          <div><dt>Subtotal</dt><dd>{validated ? formatMoney(validated.subtotal) : "—"}</dd></div>
          <div><dt>Shipping</dt><dd>{shippingPreviewCents == null ? "—" : formatMoney({ amountCents: shippingPreviewCents, currency: "EUR" })}</dd></div>
          <div className={styles.totalRow}><dt>Total preview</dt><dd>{validated && shippingPreviewCents != null ? formatMoney({ amountCents: validated.subtotal.amountCents + shippingPreviewCents, currency: "EUR" }) : "—"}</dd></div>
        </dl>
        <p>IVA inclusa nel prezzo secondo la configurazione fiscale server. Il server ricalcola tutto dentro la transazione che prenota lo stock.</p>
        <p>La prenotazione dura {reservationMinutes} minuti. Nessun pagamento viene ancora creato.</p>
        {!enabled ? (
          <div className={styles.paymentGate}>
            <strong>CHECKOUT GATE / OFF</strong>
            <span>{configurationProblems.length ? `Configurazione incompleta: ${configurationProblems.join(", ")}.` : "Lo shop o il checkout pre-payment non sono ancora abilitati."}</span>
          </div>
        ) : null}
        <button type="button" disabled={!canPrepare || busy} onClick={() => void prepare()}>
          {busy ? "Verifica…" : "Prepara ordine e prenota stock"}
        </button>
        <Link href="/cart">← Torna al carrello</Link>
        {notice ? <p className={styles.problem} role="status">{notice}</p> : null}
      </aside>
    </div>
  );
}
