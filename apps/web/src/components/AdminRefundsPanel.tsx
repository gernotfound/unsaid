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
import styles from "./AdminRefundsPanel.module.css";

type PaymentRecord = {
  id: string;
  orderId: string;
  provider: "stripe";
  providerPaymentId?: string;
  status: string;
  amount: Money;
};

type RefundCase = {
  id: string;
  orderId: string;
  amount: Money;
  reason: string;
  status: string;
  providerAction: string;
  executionState?: "idle" | "locked" | "provider_created" | "manual_review" | "complete" | "failed";
  providerRefundId?: string;
  providerStatus?: string;
  providerFailureCode?: string;
  createdAt: string;
  updatedAt: string;
};

type RefundItem = {
  refundCase: RefundCase;
  order: Order | null;
  payment: PaymentRecord | null;
};

type RefundPage = {
  items: RefundItem[];
  refundExecutionEnabled: boolean;
};

function formatMoney(money: Money) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: money.currency }).format(money.amountCents / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
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

function statusLabel(value?: string | null) {
  if (!value) return "non disponibile";
  const labels: Record<string, string> = {
    requested: "richiesta",
    approved: "approvata",
    rejected: "rifiutata",
    processed: "elaborata",
    idle: "inattiva",
    locked: "bloccata",
    provider_created: "creata presso il gestore",
    manual_review: "verifica manuale",
    complete: "completata",
    failed: "non riuscita",
    requires_action: "azione richiesta",
    paid: "pagato",
    refunded: "rimborsato",
  };
  return labels[value] ?? value;
}

function message(code: string) {
  if (code === "REFUNDS_DISABLED") return "Esecuzione Stripe disattivata. Le pratiche restano registrate senza movimento di denaro.";
  if (code === "REFUND_PROVIDER_REJECTED") return "Stripe ha rifiutato il rimborso. La pratica resta tracciata e può essere verificata.";
  if (code === "REFUND_PROVIDER_AMBIGUOUS") return "Risposta Stripe ambigua: pratica bloccata per revisione manuale, senza tentare un secondo rimborso.";
  if (code === "REFUND_RECONCILIATION_PROVIDER_REJECTED") return "Stripe non ha accettato la riconciliazione. Non è stato sbloccato alcun importo.";
  if (code === "REFUND_RECONCILIATION_AMBIGUOUS") return "Riconciliazione Stripe ancora ambigua. La somma resta bloccata e non verrà rimborsata una seconda volta.";
  if (code === "REFUND_PROVIDER_AMOUNT_MISMATCH" || code === "REFUND_PROVIDER_PAYMENT_MISMATCH") return "I dati restituiti da Stripe non corrispondono alla pratica. È richiesta verifica manuale.";
  if (code === "REFUND_AMOUNT_EXCEEDS_REMAINING") return "Il rimborso supera il saldo ancora rimborsabile.";
  if (code === "REFUND_EXECUTION_ALREADY_ACTIVE") return "Questa pratica ha già un'esecuzione Stripe attiva o da riconciliare.";
  if (code === "REFUND_ALREADY_COMPLETE") return "Rimborso già completato.";
  if (code === "REFUND_NOT_RECONCILABLE") return "Questa pratica non è in uno stato riconciliabile.";
  if (code === "ADMIN_FORBIDDEN") return "Profilo non autorizzato come amministratore.";
  return code;
}

export function AdminRefundsPanel() {
  const configured = isFirebaseClientConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<RefundItem[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it");
    if (!query) return items;
    return items.filter((item) => `${item.refundCase.id} ${item.refundCase.orderId} ${item.order?.email ?? ""} ${item.refundCase.reason}`
      .toLocaleLowerCase("it")
      .includes(query));
  }, [items, search]);

  async function load(targetUser: User) {
    setNotice("");
    try {
      const page = await apiRequest<RefundPage>(targetUser, "/api/admin/refunds");
      setItems(page.items);
      setEnabled(page.refundExecutionEnabled);
    } catch (error) {
      setNotice(message(error instanceof Error ? error.message : String(error)));
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
      if (nextUser) void load(nextUser);
      else setItems([]);
    });
  }, [configured]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    try {
      await signInWithEmailAndPassword(getAuth(getFirebaseClientApp()), email.trim(), password);
      setPassword("");
    } catch {
      setNotice("Email o password non corretti.");
    }
  }

  async function executeRefund(refundCaseId: string) {
    if (!user || busyId) return;
    setBusyId(refundCaseId);
    setNotice("");
    try {
      await apiRequest(user, `/api/admin/refunds/${encodeURIComponent(refundCaseId)}/execute`, { method: "POST" });
      await load(user);
      setNotice("Richiesta rimborso inviata a Stripe. Lo stato finale resta vincolato alla risposta del gestore o del webhook.");
    } catch (error) {
      setNotice(message(error instanceof Error ? error.message : String(error)));
      await load(user);
    } finally {
      setBusyId(null);
    }
  }

  async function reconcileRefund(refundCaseId: string) {
    if (!user || busyId) return;
    setBusyId(refundCaseId);
    setNotice("");
    try {
      await apiRequest(user, `/api/admin/refunds/${encodeURIComponent(refundCaseId)}/reconcile`, { method: "POST" });
      await load(user);
      setNotice("Stato rimborso riconciliato con Stripe senza creare una seconda pratica economica.");
    } catch (error) {
      setNotice(message(error instanceof Error ? error.message : String(error)));
      await load(user);
    } finally {
      setBusyId(null);
    }
  }

  if (!configured) return <section className={styles.center}><p>Firebase Web SDK non configurato.</p></section>;
  if (!authReady) return <section className={styles.center}><p>AUTENTICAZIONE / VERIFICA</p></section>;
  if (!user) {
    return (
      <section className={styles.center}>
        <form className={styles.login} onSubmit={login}>
          <p className={styles.kicker}>UNSAID / OPERAZIONI RIMBORSI</p>
          <h1>Rimborsi.</h1>
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button>Accedi</button>
          {notice ? <p className={styles.notice}>{notice}</p> : null}
        </form>
      </section>
    );
  }

  return (
    <section className={styles.shell}>
      <header className={styles.topbar}>
        <div><p className={styles.kicker}>UNSAID / RIMBORSI</p><strong>Controllo rimborsi Stripe</strong></div>
        <div className={styles.session}><span>{user.email}</span><button onClick={() => void signOut(getAuth(getFirebaseClientApp()))}>Esci</button></div>
      </header>

      <div className={enabled ? styles.enabled : styles.disabled}>
        <strong>{enabled ? "RIMBORSI STRIPE / ATTIVI" : "RIMBORSI STRIPE / DISATTIVATI"}</strong>
        <span>{enabled ? "Le azioni possono muovere denaro reale in base alle chiavi Stripe configurate." : "Le pratiche sono visibili, ma nessun rimborso esterno può essere eseguito."}</span>
      </div>

      <div className={styles.toolbar}>
        <input type="search" placeholder="Ordine, pratica, email, motivo…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button onClick={() => void load(user)}>Aggiorna</button>
      </div>

      <div className={styles.list}>
        {filtered.map((item) => {
          const refund = item.refundCase;
          const executable = enabled && (refund.status === "requested" || refund.status === "rejected")
            && !["locked", "provider_created", "manual_review", "complete"].includes(refund.executionState ?? "idle");
          const reconcilable = enabled && (refund.executionState === "manual_review" || refund.executionState === "provider_created");
          return (
            <article key={refund.id} data-state={refund.executionState ?? "idle"}>
              <div className={styles.head}>
                <div><small>{formatDate(refund.createdAt)}</small><strong>{refund.orderId}</strong><span>{item.order?.email ?? "ordine non disponibile"}</span></div>
                <strong>{formatMoney(refund.amount)}</strong>
              </div>
              <p>{refund.reason}</p>
              <div className={styles.meta}>
                <span>pratica: {statusLabel(refund.status)}</span>
                <span>esecuzione: {statusLabel(refund.executionState ?? "idle")}</span>
                <span>gestore: {refund.providerStatus ? statusLabel(refund.providerStatus) : "non avviato"}</span>
                <span>pagamento: {item.payment?.status ? statusLabel(item.payment.status) : "mancante"}</span>
              </div>
              {refund.providerRefundId ? <code>{refund.providerRefundId}</code> : null}
              {refund.providerFailureCode ? <p className={styles.failure}>{refund.providerFailureCode}</p> : null}
              <div className={styles.actions}>
                {executable ? <button disabled={busyId === refund.id} onClick={() => void executeRefund(refund.id)}>{busyId === refund.id ? "Invio…" : "Esegui rimborso Stripe"}</button> : null}
                {reconcilable ? <button disabled={busyId === refund.id} onClick={() => void reconcileRefund(refund.id)}>{busyId === refund.id ? "Verifica…" : "Riconcilia con Stripe"}</button> : null}
                {refund.executionState === "manual_review" ? <strong className={styles.review}>VERIFICA MANUALE — usa la riconciliazione; non creare un secondo rimborso.</strong> : null}
                {refund.executionState === "provider_created" ? <strong className={styles.review}>GESTORE IN ATTESA — verifica Stripe o attendi il webhook prima di qualsiasi altra azione.</strong> : null}
                {refund.executionState === "complete" ? <strong>RIMBORSO COMPLETATO</strong> : null}
              </div>
            </article>
          );
        })}
        {!filtered.length ? <p className={styles.empty}>Nessuna pratica rimborso.</p> : null}
      </div>
      {notice ? <div className={styles.toast} role="status">{notice}</div> : null}
    </section>
  );
}
