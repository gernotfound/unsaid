"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Money, OrderStatus } from "@unsaid/domain";
import { clearCart } from "../lib/cart";
import styles from "./PaymentReturnStatus.module.css";

type PaymentStatus = "requires_action" | "paid" | "failed" | "manual_review" | null;
type IntentStatus = "creating" | "ready" | "paid" | "failed" | "expired" | "manual_review" | null;

type StatusSnapshot = {
  orderId: string;
  orderStatus: OrderStatus;
  total: Money;
  paymentStatus: PaymentStatus;
  intentStatus: IntentStatus;
  updatedAt: string;
  reservationExpiresAt?: string;
  providerExpiresAt?: string;
  error?: string;
};

type Props = {
  mode: "success" | "cancelled";
  orderId: string;
  paymentEnabled: boolean;
};

function formatMoney(money: Money) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: money.currency,
  }).format(money.amountCents / 100);
}

function isPaidOrder(status: OrderStatus) {
  return status === "paid" || status === "processing" || status === "shipped" || status === "delivered" || status === "refunded";
}

function needsWebhookConfirmation(snapshot: StatusSnapshot) {
  return snapshot.orderStatus === "pending_payment" &&
    snapshot.paymentStatus !== "failed" &&
    snapshot.paymentStatus !== "manual_review" &&
    snapshot.intentStatus !== "failed" &&
    snapshot.intentStatus !== "expired" &&
    snapshot.intentStatus !== "manual_review";
}

export function PaymentReturnStatus({ mode, orderId, paymentEnabled }: Props) {
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  const cartCleared = useRef(false);

  const loadStatus = useCallback(async () => {
    const response = await fetch(`/api/payments/status?orderId=${encodeURIComponent(orderId)}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => ({}))) as StatusSnapshot;
    if (!response.ok) throw new Error(payload.error ?? "PAYMENT_STATUS_FAILED");
    return payload;
  }, [orderId]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function poll() {
      try {
        const next = await loadStatus();
        if (!active) return;
        setSnapshot(next);
        setNotice("");
        setBusy(false);

        if (isPaidOrder(next.orderStatus) && !cartCleared.current) {
          clearCart();
          cartCleared.current = true;
        }

        attempts += 1;
        if (mode === "success" && needsWebhookConfirmation(next) && attempts < 12) {
          timer = setTimeout(() => void poll(), 1500);
        }
      } catch (error) {
        if (!active) return;
        setBusy(false);
        const code = error instanceof Error ? error.message : "PAYMENT_STATUS_FAILED";
        setNotice(code === "AUTH_REQUIRED"
          ? "Accedi al tuo account per verificare lo stato dell'ordine."
          : "Non riesco a verificare lo stato del pagamento. Riprova tra poco.");
      }
    }

    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [loadStatus, mode]);

  async function refresh() {
    setBusy(true);
    try {
      const next = await loadStatus();
      setSnapshot(next);
      setNotice("");
      if (isPaidOrder(next.orderStatus) && !cartCleared.current) {
        clearCart();
        cartCleared.current = true;
      }
    } catch {
      setNotice("Non riesco a verificare lo stato del pagamento. Riprova tra poco.");
    } finally {
      setBusy(false);
    }
  }

  async function resumePayment() {
    if (!paymentEnabled) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/payments/stripe/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !payload.checkoutUrl) throw new Error(payload.error ?? "PAYMENT_SESSION_FAILED");
      const destination = new URL(payload.checkoutUrl);
      if (destination.protocol !== "https:") throw new Error("PAYMENT_SESSION_URL_INVALID");
      window.location.assign(destination.toString());
    } catch {
      setBusy(false);
      setNotice("Non riesco a riaprire il pagamento. Aggiorna lo stato o riprova più tardi.");
    }
  }

  const paid = snapshot ? isPaidOrder(snapshot.orderStatus) : false;
  const review = snapshot?.paymentStatus === "manual_review" || snapshot?.intentStatus === "manual_review";
  const failed = snapshot?.orderStatus === "cancelled" || snapshot?.paymentStatus === "failed" || snapshot?.intentStatus === "failed" || snapshot?.intentStatus === "expired";
  const pending = snapshot?.orderStatus === "pending_payment" && !review && !failed;
  const expiresAt = snapshot?.providerExpiresAt ?? snapshot?.reservationExpiresAt;

  let label = "PAYMENT / VERIFYING";
  let title = "Verifica pagamento";
  let copy = "Stiamo leggendo lo stato autorevole dell'ordine dal server.";
  let tone: "success" | "warning" | "neutral" = "neutral";

  if (paid) {
    label = "PAYMENT / CONFIRMED";
    title = "Ordine confermato";
    copy = "Il webhook firmato ha confermato il pagamento. Lo stock è stato impegnato definitivamente e il carrello locale è stato svuotato.";
    tone = "success";
  } else if (review) {
    label = "PAYMENT / MANUAL REVIEW";
    title = "Pagamento in verifica";
    copy = "Il provider ha segnalato un pagamento, ma il server ha rilevato uno stato che richiede verifica. Non ripetere il pagamento: l'ordine resta protetto per il controllo amministrativo.";
    tone = "warning";
  } else if (failed) {
    label = "PAYMENT / NOT COMPLETED";
    title = "Pagamento non completato";
    copy = "La sessione è stata chiusa o l'ordine è stato annullato. Se lo stock è stato rilasciato puoi tornare al carrello e ripartire.";
    tone = "warning";
  } else if (pending && mode === "success") {
    label = "PAYMENT / CONFIRMING";
    title = "Conferma in corso";
    copy = "Sei tornato da Stripe, ma il redirect del browser non prova il pagamento. Attendiamo il webhook firmato prima di confermare l'ordine.";
  } else if (pending && mode === "cancelled") {
    label = "PAYMENT / INTERRUPTED";
    title = "Pagamento interrotto";
    copy = "Hai lasciato Stripe senza completare il flusso. L'ordine può restare prenotato finché la sessione provider è valida; puoi riprendere la stessa sessione senza creare un nuovo ordine.";
    tone = "warning";
  }

  return (
    <section className={styles.panel} data-tone={tone} aria-live="polite">
      <p className={styles.kicker}>{label}</p>
      <h2>{title}</h2>
      <p className={styles.order}>{orderId}</p>
      <p className={styles.copy}>{copy}</p>

      {snapshot ? (
        <dl className={styles.details}>
          <div><dt>Ordine</dt><dd>{snapshot.orderStatus}</dd></div>
          <div><dt>Pagamento</dt><dd>{snapshot.paymentStatus ?? "in attesa"}</dd></div>
          <div><dt>Totale</dt><dd>{formatMoney(snapshot.total)}</dd></div>
          {expiresAt ? <div><dt>Sessione / hold</dt><dd>{new Date(expiresAt).toLocaleString("it-IT")}</dd></div> : null}
        </dl>
      ) : null}

      {busy ? <p className={styles.status}>Verifica server in corso…</p> : null}
      {notice ? <p className={styles.problem}>{notice}</p> : null}

      <div className={styles.actions}>
        {pending && mode === "cancelled" && paymentEnabled ? (
          <button type="button" disabled={busy} onClick={() => void resumePayment()}>Riprendi pagamento</button>
        ) : null}
        {!paid && !failed ? (
          <button className={styles.secondary} type="button" disabled={busy} onClick={() => void refresh()}>Aggiorna stato</button>
        ) : null}
        <Link href="/account">Apri account</Link>
        <Link href={paid ? "/shop" : "/cart"}>{paid ? "Torna all'archive" : "Vai al carrello"}</Link>
      </div>
    </section>
  );
}
