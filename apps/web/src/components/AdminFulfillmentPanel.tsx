"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Money, Order } from "@unsaid/domain";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseClientApp, isFirebaseClientConfigured } from "../lib/firebaseClient";
import styles from "./AdminFulfillmentPanel.module.css";

type Shipment = {
  id: string;
  orderId: string;
  customerId: string;
  provider: string;
  trackingCode?: string;
  trackingUrl?: string;
  status: "pending" | "ready" | "shipped" | "delivered" | "returned";
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
};

type Notification = {
  id: string;
  kind: "order_confirmation" | "shipment_confirmation";
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  lastErrorCode?: string;
};

type OrderListItem = {
  order: Order;
  payment: { status: string; amount: Money } | null;
  paymentIntent: { status: string } | null;
  reviewReason: string | null;
};

type OrderDetail = OrderListItem & {
  shipment: Shipment | null;
  notifications: Notification[];
};

type OrderPage = { items: OrderListItem[]; nextCursor: string | null };

function money(value: Money) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: value.currency }).format(value.amountCents / 100);
}

function date(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function message(code: string) {
  if (code === "ADMIN_FORBIDDEN") return "Account non autorizzato come admin.";
  if (code === "ADMIN_AUTH_REQUIRED") return "Sessione admin scaduta.";
  if (code === "ORDER_NOT_READY_FOR_SPEDIZIONE") return "L'ordine deve essere in processing prima della spedizione.";
  if (code === "PAYMENT_NOT_CONFIRMED") return "Pagamento non confermato lato server.";
  if (code === "INVALID_SPEDIZIONE_PROVIDER") return "Inserisci un corriere valido.";
  if (code === "INVALID_TRACKING_CODE") return "Inserisci un codice tracking valido.";
  if (code === "INVALID_TRACKING_URL") return "Il link tracking deve essere un URL HTTPS valido.";
  if (code === "SPEDIZIONE_ALREADY_INVIOED" || code === "SPEDIZIONE_STATE_CONFLICT") return "La spedizione è già in uno stato successivo.";
  if (code === "SPEDIZIONE_NOT_READY_FOR_DELIVERY") return "La spedizione deve essere prima marcata come shipped.";
  return code === "INTERNAL_ERROR" ? "Errore del sistema. Riprova." : code;
}

async function request<T>(user: User, url: string, init: RequestInit = {}) {
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

export function AdminFulfillmentPanel() {
  const configured = isFirebaseClientConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [provider, setProvider] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const operational = useMemo(
    () => items.filter((item) => ["processing", "shipped", "delivered"].includes(item.order.status)),
    [items],
  );

  async function loadDetail(targetUser: User, orderId: string) {
    setBusy(true);
    setNotice("");
    try {
      const next = await request<OrderDetail>(targetUser, `/api/admin/orders/${encodeURIComponent(orderId)}`);
      setDetail(next);
      setProvider(next.shipment?.provider ?? "");
      setTrackingCode(next.shipment?.trackingCode ?? "");
      setTrackingUrl(next.shipment?.trackingUrl ?? "");
      setItems((current) => current.map((item) => item.order.id === next.order.id
        ? { order: next.order, payment: next.payment, paymentIntent: next.paymentIntent, reviewReason: next.reviewReason }
        : item));
    } catch (error) {
      setNotice(message(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  async function loadPage(targetUser: User, reset = true) {
    setBusy(true);
    setNotice("");
    try {
      const suffix = !reset && cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const page = await request<OrderPage>(targetUser, `/api/admin/orders${suffix}`);
      const nextItems = reset ? page.items : [...items, ...page.items];
      setItems(nextItems);
      setCursor(page.nextCursor);
      if (reset) {
        const first = nextItems.find((item) => ["processing", "shipped", "delivered"].includes(item.order.status));
        if (first) await loadDetail(targetUser, first.order.id);
        else setDetail(null);
      }
    } catch (error) {
      setNotice(message(error instanceof Error ? error.message : String(error)));
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

  async function action(actionName: "shipment_ready" | "shipped" | "delivered") {
    if (!user || !detail) return;
    setBusy(true);
    setNotice("");
    try {
      const next = await request<OrderDetail>(user, `/api/admin/orders/${encodeURIComponent(detail.order.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: actionName,
          provider,
          trackingCode,
          trackingUrl,
        }),
      });
      setDetail(next);
      setProvider(next.shipment?.provider ?? provider);
      setTrackingCode(next.shipment?.trackingCode ?? trackingCode);
      setTrackingUrl(next.shipment?.trackingUrl ?? trackingUrl);
      setItems((current) => current.map((item) => item.order.id === next.order.id
        ? { order: next.order, payment: next.payment, paymentIntent: next.paymentIntent, reviewReason: next.reviewReason }
        : item));
      setNotice(actionName === "shipment_ready"
        ? "Spedizione preparata."
        : actionName === "shipped"
          ? "Ordine segnato come spedito e notifica di spedizione accodata."
          : "Ordine segnato come consegnato.");
    } catch (error) {
      setNotice(message(error instanceof Error ? error.message : String(error)));
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
          <p className={styles.kicker}>UNSAID / SPEDIZIONI</p>
          <h1>Admin.</h1>
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button disabled={busy}>{busy ? "Accesso…" : "Accedi"}</button>
          {notice ? <p>{notice}</p> : null}
        </form>
      </section>
    );
  }

  return (
    <section className={styles.shell}>
      <header className={styles.topbar}>
        <div><p className={styles.kicker}>UNSAID / SPEDIZIONI</p><strong>Spedizioni + notifiche cliente</strong></div>
        <div className={styles.session}><span>{user.email}</span><button onClick={() => void signOut(getAuth(getFirebaseClientApp()))}>Esci</button></div>
      </header>
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.summary}><span>Ordini operativi</span><strong>{operational.length}</strong></div>
          {operational.map((item) => (
            <button key={item.order.id} data-active={detail?.order.id === item.order.id} onClick={() => void loadDetail(user, item.order.id)}>
              <span>{item.order.status}</span><strong>{item.order.id}</strong><small>{item.order.email}</small><em>{money(item.order.totals.total)}</em>
            </button>
          ))}
          {!operational.length ? <p className={styles.empty}>Nessun ordine da evadere.</p> : null}
          {cursor ? <button className={styles.more} disabled={busy} onClick={() => void loadPage(user, false)}>Carica altri</button> : null}
        </aside>

        <main className={styles.editor}>
          {detail ? (
            <>
              <div className={styles.head}><div><p className={styles.kicker}>{detail.order.status}</p><h1>{detail.order.id}</h1></div><strong>{money(detail.order.totals.total)}</strong></div>
              {detail.reviewReason ? <div className={styles.warning}>VERIFICA MANUALE / non spedire questo ordine.</div> : null}

              <div className={styles.cards}>
                <section><p className={styles.kicker}>DESTINAZIONE</p><strong>{detail.order.shippingAddress.recipientName}</strong><span>{detail.order.shippingAddress.line1}</span><span>{detail.order.shippingAddress.postalCode} {detail.order.shippingAddress.city} ({detail.order.shippingAddress.province})</span></section>
                <section><p className={styles.kicker}>SPEDIZIONE</p><strong>{detail.shipment?.status ?? "non preparata"}</strong><span>{detail.shipment?.provider ?? "—"}</span><span>{detail.shipment?.trackingCode ?? "—"}</span>{detail.shipment?.trackingUrl ? <a href={detail.shipment.trackingUrl} target="_blank" rel="noreferrer">Apri tracciamento</a> : null}</section>
              </div>

              {detail.order.status === "processing" ? (
                <section className={styles.formSection}>
                  <div><p className={styles.kicker}>INVIO</p><h2>Prepara spedizione</h2></div>
                  <div className={styles.formGrid}>
                    <label><span>Corriere</span><input value={provider} maxLength={80} placeholder="es. BRT" onChange={(event) => setProvider(event.target.value)} /></label>
                    <label><span>Codice di tracciamento</span><input value={trackingCode} maxLength={120} onChange={(event) => setTrackingCode(event.target.value)} /></label>
                    <label><span>URL di tracciamento HTTPS</span><input type="url" value={trackingUrl} maxLength={500} onChange={(event) => setTrackingUrl(event.target.value)} /></label>
                  </div>
                  <div className={styles.actions}>
                    <button disabled={busy || provider.trim().length < 2} onClick={() => void action("shipment_ready")}>Salva come pronta</button>
                    <button className={styles.primary} disabled={busy || provider.trim().length < 2 || trackingCode.trim().length < 3} onClick={() => void action("shipped")}>Segna spedito</button>
                  </div>
                </section>
              ) : null}

              {detail.order.status === "shipped" ? (
                <div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={() => void action("delivered")}>Segna consegnato</button></div>
              ) : null}

              <section className={styles.notifications}>
                <div><p className={styles.kicker}>CODA EMAIL CLIENTE</p><h2>Notifiche</h2></div>
                {detail.notifications.length ? detail.notifications.map((notification) => (
                  <article key={notification.id}><strong>{notification.kind}</strong><span>{notification.status}</span><small>{notification.attempts} tentativi · {date(notification.sentAt ?? notification.updatedAt)}</small>{notification.lastErrorCode ? <em>{notification.lastErrorCode}</em> : null}</article>
                )) : <p className={styles.empty}>Nessuna notifica ancora accodata.</p>}
                <p className={styles.note}>La coda è indipendente dal gestore: nessuna email esterna viene inviata finché non colleghiamo e abilitiamo un gestore.</p>
              </section>
            </>
          ) : <p className={styles.empty}>Nessun ordine operativo selezionato.</p>}
        </main>
      </div>
      {notice ? <div className={styles.toast} role="status">{notice}</div> : null}
    </section>
  );
}
