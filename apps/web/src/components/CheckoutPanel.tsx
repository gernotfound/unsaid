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
  paymentEnabled: boolean;
  error?: string;
};

type PaymentSessionResponse = {
  orderId?: string;
  checkoutUrl?: string;
  expiresAt?: string;
  reused?: boolean;
  error?: string;
};

type Props = {
  enabled: boolean;
  paymentEnabled: boolean;
  paymentProblems: readonly string[];
  paymentSessionMinutes: number;
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

function orderStatusLabel(status: Order["status"]) {
  const labels: Record<Order["status"], string> = {
    pending_payment: "in attesa di pagamento",
    paid: "pagato",
    processing: "in lavorazione",
    shipped: "spedito",
    delivered: "consegnato",
    cancelled: "annullato",
    refunded: "rimborsato",
  };
  return labels[status];
}

function newIdempotencyKey() {
  return globalThis.crypto.randomUUID();
}

function errorLabel(code: string) {
  if (code === "AUTH_REQUIRED") return "Accedi al tuo profilo prima di continuare.";
  if (code === "EMAIL_NOT_VERIFIED") return "Verifica l'email prima di preparare l'ordine.";
  if (code === "ADDRESS_NOT_FOUND" || code === "INVALID_SHIPPING_ADDRESS") return "L'indirizzo selezionato non è più disponibile o non è valido.";
  if (code.startsWith("OUT_OF_STOCK:")) return "Le scorte sono cambiate. Torna al carrello e ricontrolla le quantità.";
  if (code.startsWith("VARIANT_UNAVAILABLE:") || code.startsWith("PRODUCT_UNAVAILABLE:")) return "Un articolo non è più disponibile alla vendita.";
  if (code === "CHECKOUT_DISABLED" || code === "CHECKOUT_CONFIGURATION_INCOMPLETE") return "La conferma dell'ordine non è ancora abilitata per questa installazione.";
  if (code === "PAYMENTS_DISABLED" || code === "PAYMENT_CONFIGURATION_INCOMPLETE") return "Il pagamento non è ancora abilitato per questa installazione.";
  if (code === "PAYMENT_SESSION_IN_PROGRESS") return "Una sessione di pagamento è già in preparazione. Riprova tra pochi secondi.";
  if (code === "PAYMENT_PROVIDER_UNAVAILABLE") return "Il provider di pagamento non è disponibile. Riprova senza creare un nuovo ordine.";
  if (code === "ORDER_RESERVATION_EXPIRED") return "La prenotazione delle scorte è scaduta. Torna al carrello e prepara un nuovo ordine.";
  if (code === "PAYMENT_SESSION_ACTIVE") return "Il pagamento è già stato avviato. Le scorte restano protette fino alla chiusura della sessione.";
  if (code === "IDEMPOTENCY_CONFLICT") return "La richiesta di conferma ordine non è coerente con il tentativo precedente. Ricarica la pagina.";
  return "Operazione non riuscita. Riprova.";
}

export function CheckoutPanel({
  enabled,
  paymentEnabled,
  paymentProblems,
  paymentSessionMinutes,
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
      setNotice("Impossibile verificare il carrello con il sistema.");
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

  async function startPayment() {
    if (!prepared || prepared.status !== "pending_payment" || !paymentEnabled) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/payments/stripe/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: prepared.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as PaymentSessionResponse;
      if (!response.ok || !payload.checkoutUrl) throw new Error(payload.error ?? "PAYMENT_SESSION_FAILED");
      const destination = new URL(payload.checkoutUrl);
      if (destination.protocol !== "https:") throw new Error("PAYMENT_SESSION_URL_INVALID");
      window.location.assign(destination.toString());
    } catch (error) {
      setNotice(errorLabel(error instanceof Error ? error.message : String(error)));
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
    } catch (error) {
      setNotice(errorLabel(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  if (!localLines.length && !busy) {
    return (
      <section className={styles.blocked}>
        <strong>CARRELLO / VUOTO</strong>
        <p>Aggiungi almeno una maglia prima di confermare l'ordine.</p>
        <Link href="/shop">Torna all&apos;archivio →</Link>
      </section>
    );
  }

  if (prepared) {
    const expires = prepared.reservationExpiresAt ? new Date(prepared.reservationExpiresAt) : null;
    return (
      <section className={styles.prepared}>
        <p className={styles.kicker}>ORDINE / {orderStatusLabel(prepared.status).toUpperCase()}</p>
        <h2>{prepared.id}</h2>
        <div className={styles.totalRow}><span>Totale</span><strong>{formatMoney(prepared.totals.total)}</strong></div>
        <p>
          {prepared.status === "pending_payment"
            ? `Scorte prenotate${expires ? ` fino alle ${expires.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : ""}.`
            : "Prenotazione annullata e scorte rilasciate."}
        </p>

        {prepared.status === "pending_payment" ? (
          <>
            <div className={styles.paymentGate}>
              <strong>{paymentEnabled ? "PAGAMENTO / STRIPE" : "PAGAMENTO / DISATTIVATO"}</strong>
              <span>
                {paymentEnabled
                  ? `Il pagamento si apre sulla pagina sicura di Stripe. La sessione dura circa ${paymentSessionMinutes} minuti; il ritorno del browser non viene mai usato come prova di pagamento.`
                  : paymentProblems.length
                    ? `Configurazione pagamento incompleta: ${paymentProblems.join(", ")}.`
                    : "Il pagamento resta disattivato tramite il controllo di attivazione."}
              </span>
            </div>
            {paymentEnabled ? (
              <button type="button" disabled={busy} onClick={() => void startPayment()}>
                {busy ? "Apertura pagamento…" : "Vai al pagamento sicuro"}
              </button>
            ) : null}
            <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void cancelPreparedOrder()}>
              Annulla ordine e rilascia stock
            </button>
          </>
        ) : (
          <Link href="/cart">Torna al carrello →</Link>
        )}
        {notice ? <p className={styles.problem} role="status">{notice}</p> : null}
      </section>
    );
  }

  return (
    <div className={styles.grid}>
      <section className={styles.main}>
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>01 / CARRELLO / VERIFICA SERVER</p>
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
          <p className={styles.kicker}>02 / INDIRIZZO DI SPEDIZIONE</p>
          <strong>Italia soltanto</strong>
        </div>
        {sessionState === "missing" ? (
          <div className={styles.blocked}><strong>PROFILO RICHIESTO</strong><p>Devi accedere prima del checkout.</p><Link href="/account">Accedi / crea profilo →</Link></div>
        ) : sessionState === "unverified" ? (
          <div className={styles.blocked}><strong>VERIFICA EMAIL RICHIESTA</strong><p>Verifica l&apos;email e aggiorna la sessione dall&apos;area personale.</p><Link href="/account">Apri area personale →</Link></div>
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
          <div className={styles.blocked}><strong>INDIRIZZO DI SPEDIZIONE RICHIESTO</strong><p>Salva almeno un indirizzo italiano nel profilo.</p><Link href="/account">Aggiungi indirizzo →</Link></div>
        )}
      </section>

      <aside className={styles.summary}>
        <p className={styles.kicker}>03 / RIEPILOGO VERIFICATO</p>
        <dl>
          <div><dt>Subtotale</dt><dd>{validated ? formatMoney(validated.subtotal) : "—"}</dd></div>
          <div><dt>Spedizione</dt><dd>{shippingPreviewCents == null ? "—" : formatMoney({ amountCents: shippingPreviewCents, currency: "EUR" })}</dd></div>
          <div className={styles.totalRow}><dt>Totale stimato</dt><dd>{validated && shippingPreviewCents != null ? formatMoney({ amountCents: validated.subtotal.amountCents + shippingPreviewCents, currency: "EUR" }) : "—"}</dd></div>
        </dl>
        <p>IVA inclusa nel prezzo secondo la configurazione fiscale del sistema. Il sistema ricalcola tutto nella transazione che prenota le scorte.</p>
        <p>La prima prenotazione dura {reservationMinutes} minuti. Se avvii il pagamento, il server estende la prenotazione per allinearla alla sessione Stripe e al margine di attesa del webhook.</p>
        {!enabled ? (
          <div className={styles.paymentGate}>
            <strong>CONFERMA ORDINE / DISATTIVATA</strong>
            <span>{configurationProblems.length ? `Configurazione incompleta: ${configurationProblems.join(", ")}.` : "Le vendite o la conferma ordine prima del pagamento non sono ancora abilitate."}</span>
          </div>
        ) : null}
        <button type="button" disabled={!canPrepare || busy} onClick={() => void prepare()}>
          {busy ? "Verifica…" : "Prepara ordine e prenota le scorte"}
        </button>
        <Link href="/cart">← Torna al carrello</Link>
        {notice ? <p className={styles.problem} role="status">{notice}</p> : null}
      </aside>
    </div>
  );
}
