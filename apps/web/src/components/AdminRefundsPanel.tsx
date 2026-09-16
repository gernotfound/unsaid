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

function message(code: string) {
  if (code === "REFUNDS_DISABLED") return "Esecuzione Stripe disattivata. Le pratiche restano registrate senza movimento di denaro.";
  if (code === "REFUND_PROVIDER_REJECTED") return "Stripe ha rifiutato il rimborso. La pratica resta tracciata e può essere verificata.";
  if (code === "REFUND_PROVIDER_AMBIGUOUS") return "Risposta Stripe ambigua: pratica bloccata per revisione manuale, senza tentare un secondo rimborso.";
  if (code === "REFUND_AMOUNT_EXCEEDS_REMAINING") return "Il rimborso supera il saldo ancora rimborsabile.";
  if (code === "REFUND_EXECUTION_ALREADY_ACTIVE") return "Questa pratica ha già un'esecuzione Stripe attiva o da riconciliare.";
  if (code === "REFUND_ALREADY_COMPLETE") return "Rimborso già completato.";
  if (code === "ADMIN_FORBIDDEN") return "Account non autorizzato come admin.";
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
      setNotice("Richiesta rimborso inviata a Stripe. Lo stato finale resta vincolato alla risposta provider/webhook.");
    } catch (error) {
      setNotice(message(error instanceof Error ? error.message : String(error)));
      await load(user);
    } finally {
      setBusyId(null);
    }
  }

  if (!configured) return <section className={styles.center}><p>Firebase Web SDK non configurato.</p></section>;
  if (!authReady) return <section className={styles.center}><p>AUTH / CHECKING</p></section>;
  if (!user) {
    return (
      <section className={styles.center}>
        <form className={styles.login} onSubmit={login}>
          <p className={styles.kicker}>UNSAID / REFUND OPERATIONS</p>
          <h1>Refunds.</h1>
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
        <div><p className={styles.kicker}>UNSAID / REFUNDS</p><strong>Stripe refund control</strong></div>
        <div className={styles.session}><span>{user.email}</span><button onClick={() => void signOut(getAuth(getFirebaseClientApp()))}>Esci</button></div>
      </header>

      <div className={enabled ? styles.enabled : styles.disabled}>
        <strong>{enabled ? "STRIPE REFUNDS / ENABLED" : "STRIPE REFUNDS / DISABLED"}</strong>
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
          return (
            <article key={refund.id} data-state={refund.executionState ?? "idle"}>
              <div className={styles.head}>
                <div><small>{formatDate(refund.createdAt)}</small><strong>{refund.orderId}</strong><span>{item.order?.email ?? "ordine non disponibile"}</span></div>
                <strong>{formatMoney(refund.amount)}</strong>
              </div>
              <p>{refund.reason}</p>
              <div className={styles.meta}>
                <span>case: {refund.status}</span>
                <span>execution: {refund.executionState ?? "idle"}</span>
                <span>provider: {refund.providerStatus ?? "not started"}</span>
                <span>payment: {item.payment?.status ?? "missing"}</span>
              </div>
              {refund.providerRefundId ? <code>{refund.providerRefundId}</code> : null}
              {refund.providerFailureCode ? <p className={styles.failure}>{refund.providerFailureCode}</p> : null}
              <div className={styles.actions}>
                {executable ? <button disabled={busyId === refund.id} onClick={() => void executeRefund(refund.id)}>{busyId === refund.id ? "Invio…" : "Esegui rimborso Stripe"}</button> : null}
                {refund.executionState === "manual_review" ? <strong className={styles.review}>MANUAL REVIEW — non ripetere il rimborso prima della riconciliazione Stripe.</strong> : null}
                {refund.executionState === "complete" ? <strong>REFUND COMPLETE</strong> : null}
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
