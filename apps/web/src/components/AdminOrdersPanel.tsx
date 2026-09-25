"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { InventoryReservation, Money, Order, OrderStatus } from "@unsaid/domain";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseClientApp, isFirebaseClientConfigured } from "../lib/firebaseClient";
import styles from "./AdminOrdersPanel.module.css";

type PaymentStatus = "requires_action" | "paid" | "failed" | "manual_review";
type IntentStatus = "creating" | "ready" | "paid" | "failed" | "expired" | "manual_review";

type PaymentRecord = {
  id: string;
  orderId: string;
  provider: "stripe";
  providerSessionId: string;
  providerPaymentId?: string;
  status: PaymentStatus;
  amount: Money;
  createdAt: string;
  updatedAt: string;
};

type PaymentIntent = {
  id: string;
  customerId: string;
  orderId: string;
  provider: "stripe";
  status: IntentStatus;
  providerSessionId?: string;
  providerExpiresAt: string;
  holdExpiresAt: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
};

type RefundCase = {
  id: string;
  orderId: string;
  amount: Money;
  reason: string;
  status: "requested" | "approved" | "rejected" | "processed";
  providerAction: "not_executed" | "executed";
  requestedByAdminUid: string;
  createdAt: string;
  updatedAt: string;
};

type AdminOrderListItem = {
  order: Order;
  payment: PaymentRecord | null;
  paymentIntent: PaymentIntent | null;
  reviewReason: string | null;
};

type AdminOrderDetail = AdminOrderListItem & {
  reservations: InventoryReservation[];
  refundCases: RefundCase[];
};

type AdminOrderPage = { items: AdminOrderListItem[]; nextCursor: string | null };

type Filter = "all" | "manual_review" | OrderStatus;

const ORDER_FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Tutti" },
  { value: "manual_review", label: "Verifica manuale" },
  { value: "pending_payment", label: "In attesa" },
  { value: "paid", label: "Pagati" },
  { value: "processing", label: "In lavorazione" },
  { value: "shipped", label: "Spediti" },
  { value: "delivered", label: "Consegnati" },
  { value: "cancelled", label: "Annullati" },
  { value: "refunded", label: "Rimborsati" },
];

function technicalStatusLabel(value: string | null | undefined) {
  if (!value) return "non disponibile";
  const labels: Record<string, string> = {
    pending_payment: "in attesa di pagamento",
    paid: "pagato",
    processing: "in lavorazione",
    shipped: "spedito",
    delivered: "consegnato",
    cancelled: "annullato",
    refunded: "rimborsato",
    requires_action: "azione richiesta",
    failed: "non riuscito",
    manual_review: "verifica manuale",
    creating: "creazione",
    ready: "pronto",
    expired: "scaduto",
    requested: "richiesto",
    approved: "approvato",
    rejected: "rifiutato",
    processed: "elaborato",
    not_executed: "non eseguita",
    executed: "eseguita",
    active: "attiva",
    released: "rilasciata",
    converted: "convertita",
  };
  return labels[value] ?? value;
}

function formatMoney(money: Money) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: money.currency }).format(money.amountCents / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function euroInputToCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function errorMessage(code: string) {
  if (code === "ADMIN_FORBIDDEN") return "Questo profilo non è autorizzato come amministratore.";
  if (code === "ADMIN_AUTH_REQUIRED") return "Sessione amministratore scaduta. Accedi di nuovo.";
  if (code === "ORDER_NOT_READY_FOR_PROCESSING") return "L'ordine deve essere pagato prima di passare in lavorazione.";
  if (code === "PAYMENT_NOT_CONFIRMED") return "Il pagamento verificato dal sistema non risulta confermato.";
  if (code === "PAYMENT_SESSION_ACTIVE") return "La sessione di pagamento è ancora attiva: l'ordine non può essere annullato.";
  if (code === "ORDER_NOT_CANCELLABLE") return "Questo ordine non può essere annullato nello stato corrente.";
  if (code === "ORDER_NOT_REFUND_ELIGIBLE" || code === "PAYMENT_NOT_REFUND_ELIGIBLE") return "Questo ordine non è ancora idoneo a una pratica di rimborso.";
  if (code === "REFUND_AMOUNT_EXCEEDS_PAYMENT") return "L'importo supera il pagamento registrato.";
  if (code === "INVALID_REFUND_AMOUNT") return "Importo rimborso non valido.";
  if (code === "INVALID_REFUND_REASON") return "Inserisci una motivazione di almeno 3 caratteri.";
  if (code === "INTERNAL_ERROR") return "Errore del sistema. Riprova.";
  return code;
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

function statusTone(item: AdminOrderListItem) {
  if (item.reviewReason || item.payment?.status === "manual_review" || item.paymentIntent?.status === "manual_review") return "review";
  if (item.order.status === "paid" || item.order.status === "processing") return "good";
  if (item.order.status === "cancelled" || item.payment?.status === "failed") return "muted";
  return "neutral";
}

export function AdminOrdersPanel() {
  const configured = isFirebaseClientConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<AdminOrderListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it");
    return items.filter((item) => {
      const filterMatch = filter === "all"
        ? true
        : filter === "manual_review"
          ? Boolean(item.reviewReason || item.payment?.status === "manual_review" || item.paymentIntent?.status === "manual_review")
          : item.order.status === filter;
      if (!filterMatch) return false;
      if (!query) return true;
      const lineText = item.order.lines.map((line) => `${line.sku} ${line.title}`).join(" ");
      return `${item.order.id} ${item.order.email} ${lineText}`.toLocaleLowerCase("it").includes(query);
    });
  }, [filter, items, search]);

  const metrics = useMemo(() => ({
    loaded: items.length,
    pending: items.filter((item) => item.order.status === "pending_payment").length,
    paid: items.filter((item) => item.order.status === "paid" || item.order.status === "processing").length,
    review: items.filter((item) => item.reviewReason || item.payment?.status === "manual_review" || item.paymentIntent?.status === "manual_review").length,
  }), [items]);

  function mergeDetail(next: AdminOrderDetail) {
    setDetail(next);
    setSelectedId(next.order.id);
    setItems((current) => current.map((item) => item.order.id === next.order.id
      ? { order: next.order, payment: next.payment, paymentIntent: next.paymentIntent, reviewReason: next.reviewReason }
      : item));
    if (!refundAmount) setRefundAmount((next.order.totals.total.amountCents / 100).toFixed(2).replace(".", ","));
  }

  async function loadPage(targetUser: User, reset = true) {
    setBusy(true);
    setNotice("");
    try {
      const suffix = !reset && cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const page = await apiRequest<AdminOrderPage>(targetUser, `/api/admin/orders${suffix}`);
      setItems((current) => reset ? page.items : [...current, ...page.items]);
      setCursor(page.nextCursor);
      if (reset && page.items[0]) await loadDetail(targetUser, page.items[0].order.id);
      if (reset && !page.items.length) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (error) {
      setNotice(errorMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  async function loadDetail(targetUser: User, orderId: string) {
    setBusy(true);
    setNotice("");
    try {
      const next = await apiRequest<AdminOrderDetail>(targetUser, `/api/admin/orders/${encodeURIComponent(orderId)}`);
      setRefundAmount((next.order.totals.total.amountCents / 100).toFixed(2).replace(".", ","));
      setRefundReason("");
      mergeDetail(next);
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
      if (nextUser) void loadPage(nextUser, true);
      else {
        setItems([]);
        setSelectedId(null);
        setDetail(null);
      }
    });
  }, [configured]);

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

  async function orderAction(action: "processing" | "cancel") {
    if (!user || !detail) return;
    setBusy(true);
    setNotice("");
    try {
      const next = await apiRequest<AdminOrderDetail>(user, `/api/admin/orders/${encodeURIComponent(detail.order.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      mergeDetail(next);
      setNotice(action === "processing" ? "Ordine passato in lavorazione." : "Ordine annullato e scorte rilasciate.");
    } catch (error) {
      setNotice(errorMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  async function createRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !detail) return;
    const amountCents = euroInputToCents(refundAmount);
    if (amountCents == null) {
      setNotice("Importo rimborso non valido.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const payload = await apiRequest<{ detail: AdminOrderDetail }>(
        user,
        `/api/admin/orders/${encodeURIComponent(detail.order.id)}/refund`,
        {
          method: "POST",
          body: JSON.stringify({
            amountCents,
            reason: refundReason,
            idempotencyKey: globalThis.crypto.randomUUID(),
          }),
        },
      );
      mergeDetail(payload.detail);
      setRefundReason("");
      setNotice("Pratica rimborso registrata. Nessun denaro è stato ancora restituito dal gestore del pagamento.");
    } catch (error) {
      setNotice(errorMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  if (!configured) return <section className={styles.center}><p>Firebase Web SDK non configurato.</p></section>;
  if (!authReady) return <section className={styles.center}><p>AUTENTICAZIONE / VERIFICA</p></section>;
  if (!user) {
    return (
      <section className={styles.center}>
        <form className={styles.login} onSubmit={login}>
          <p className={styles.kicker}>UNSAID / OPERAZIONI ORDINI</p>
          <h1>Admin.</h1>
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button disabled={busy}>{busy ? "Accesso…" : "Accedi"}</button>
          {notice ? <p className={styles.notice}>{notice}</p> : null}
        </form>
      </section>
    );
  }

  const refundEligible = Boolean(detail && detail.payment?.status === "paid" && ["paid", "processing", "shipped", "delivered"].includes(detail.order.status));

  return (
    <section className={styles.shell}>
      <header className={styles.topbar}>
        <div><p className={styles.kicker}>UNSAID / ORDINI</p><strong>Controllo pagamenti + spedizioni</strong></div>
        <div className={styles.session}><span>{user.email}</span><button onClick={() => void signOut(getAuth(getFirebaseClientApp()))}>Esci</button></div>
      </header>

      <div className={styles.metrics}>
        <div><span>Caricati</span><strong>{metrics.loaded}</strong></div>
        <div><span>In attesa</span><strong>{metrics.pending}</strong></div>
        <div><span>Pagati / lavorazione</span><strong>{metrics.paid}</strong></div>
        <div data-alert={metrics.review > 0}><span>Verifica manuale</span><strong>{metrics.review}</strong></div>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.filters}>
            <input aria-label="Cerca ordine" type="search" placeholder="Ordine, email, SKU…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filtra stato" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
              {ORDER_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className={styles.list}>
            {filtered.map((item) => (
              <button key={item.order.id} data-active={item.order.id === selectedId} data-tone={statusTone(item)} onClick={() => void loadDetail(user, item.order.id)}>
                <span>{formatDate(item.order.createdAt)} / {technicalStatusLabel(item.order.status)}</span>
                <strong>{item.order.id}</strong>
                <small>{item.order.email}</small>
                <em>{formatMoney(item.order.totals.total)} · {technicalStatusLabel(item.payment?.status)}</em>
              </button>
            ))}
            {!filtered.length ? <p className={styles.empty}>Nessun ordine nel filtro corrente.</p> : null}
          </div>
          {cursor && filter === "all" && !search ? <button className={styles.loadMore} disabled={busy} onClick={() => void loadPage(user, false)}>Carica altri</button> : null}
        </aside>

        <main className={styles.editor}>
          {detail ? (
            <>
              <div className={styles.editorHead}>
                <div><p className={styles.kicker}>{formatDate(detail.order.createdAt)} / {technicalStatusLabel(detail.order.status)}</p><h1>{detail.order.id}</h1></div>
                <div className={styles.total}><span>Totale</span><strong>{formatMoney(detail.order.totals.total)}</strong></div>
              </div>

              {detail.reviewReason || detail.payment?.status === "manual_review" || detail.paymentIntent?.status === "manual_review" ? (
                <div className={styles.reviewBanner}><strong>VERIFICA MANUALE RICHIESTA</strong><span>{detail.reviewReason ?? detail.paymentIntent?.errorCode ?? "payment_state_mismatch"}</span><p>Non spedire e non creare un nuovo pagamento finché denaro, ordine e scorte non sono riconciliati.</p></div>
              ) : null}

              <div className={styles.infoGrid}>
                <section><p className={styles.kicker}>CLIENTE</p><strong>{detail.order.email}</strong><span>{detail.order.shippingAddress.recipientName}</span><span>{detail.order.shippingAddress.line1}</span><span>{detail.order.shippingAddress.postalCode} {detail.order.shippingAddress.city} ({detail.order.shippingAddress.province})</span></section>
                <section><p className={styles.kicker}>PAGAMENTO</p><strong>{technicalStatusLabel(detail.payment?.status)}</strong><span>Tentativo: {technicalStatusLabel(detail.paymentIntent?.status)}</span><span>Sessione: {detail.payment?.providerSessionId ?? detail.paymentIntent?.providerSessionId ?? "—"}</span><span>Pagamento gestore: {detail.payment?.providerPaymentId ?? "—"}</span></section>
                <section><p className={styles.kicker}>TOTALI</p><span>Subtotale {formatMoney(detail.order.totals.subtotal)}</span><span>Spedizione {formatMoney(detail.order.totals.shipping)}</span><span>Imposte incl. {formatMoney(detail.order.totals.tax)}</span><strong>{formatMoney(detail.order.totals.total)}</strong></section>
              </div>

              <section className={styles.linesSection}>
                <div className={styles.sectionHead}><p className={styles.kicker}>RIGHE ORDINE</p><span>{detail.order.lines.length} SKU</span></div>
                <div className={styles.lineHeader}><span>SKU</span><span>Prodotto</span><span>Qtà</span><span>Unità</span><span>Prenotazione</span></div>
                {detail.order.lines.map((line) => {
                  const reservation = detail.reservations.find((entry) => entry.variantId === line.variantId);
                  return <div className={styles.lineRow} key={line.variantId}><code>{line.sku}</code><span>{line.title} / {line.size}</span><strong>{line.quantity}</strong><span>{formatMoney(line.unitPrice)}</span><span>{technicalStatusLabel(reservation?.status)}</span></div>;
                })}
              </section>

              <div className={styles.actions}>
                {detail.order.status === "paid" && detail.payment?.status === "paid" ? <button disabled={busy} onClick={() => void orderAction("processing")}>Avvia lavorazione</button> : null}
                {detail.order.status === "pending_payment" ? <button className={styles.danger} disabled={busy} onClick={() => void orderAction("cancel")}>Annulla ordine in attesa</button> : null}
                <button className={styles.secondary} disabled={busy} onClick={() => void loadDetail(user, detail.order.id)}>Aggiorna stato</button>
              </div>

              <section className={styles.refunds}>
                <div className={styles.sectionHead}><div><p className={styles.kicker}>PRATICHE RIMBORSO</p><strong>{detail.refundCases.length} pratiche</strong></div><p>Questa fase registra soltanto la pratica operativa. Non invia ancora un rimborso a Stripe.</p></div>
                {detail.refundCases.map((refund) => <article key={refund.id}><div><strong>{formatMoney(refund.amount)}</strong><span>{technicalStatusLabel(refund.status)} / {technicalStatusLabel(refund.providerAction)}</span></div><p>{refund.reason}</p><small>{formatDate(refund.createdAt)} · {refund.id}</small></article>)}
                {refundEligible ? (
                  <form className={styles.refundForm} onSubmit={createRefund}>
                    <label><span>Importo EUR</span><input inputMode="decimal" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} required /></label>
                    <label className={styles.reason}><span>Motivazione</span><textarea maxLength={500} value={refundReason} onChange={(event) => setRefundReason(event.target.value)} required /></label>
                    <button disabled={busy}>Apri pratica rimborso</button>
                  </form>
                ) : <p className={styles.muted}>Pratica rimborso disponibile soltanto con pagamento confermato e ordine in stato operativo compatibile.</p>}
              </section>
            </>
          ) : <p className={styles.empty}>Seleziona un ordine.</p>}
        </main>
      </div>
      {notice ? <div className={styles.toast} role="status">{notice}</div> : null}
    </section>
  );
}
