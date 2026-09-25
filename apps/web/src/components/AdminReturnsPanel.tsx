"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Money, Order, ReturnCase } from "@unsaid/domain";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseClientApp, isFirebaseClientConfigured } from "../lib/firebaseClient";
import styles from "./AdminReturnsPanel.module.css";

type ReturnItem = {
  returnCase: ReturnCase;
  order: Order | null;
  refundCase: Record<string, unknown> | null;
};

type ReturnPage = { items: ReturnItem[] };

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

function returnStatusLabel(status: ReturnCase["status"]) {
  return {
    requested: "RICHIESTO",
    approved: "APPROVATO",
    rejected: "RIFIUTATO",
    in_transit: "IN RIENTRO",
    received: "RICEVUTO",
    inspected: "ISPEZIONATO",
    closed: "CHIUSO",
  }[status];
}

function reasonLabel(code: ReturnCase["reasonCode"]) {
  return {
    changed_mind: "Ho cambiato idea",
    size_issue: "Taglia / vestibilità",
    damaged: "Articolo danneggiato",
    wrong_item: "Articolo errato",
    other: "Altro",
  }[code];
}

function message(code: string) {
  if (code === "RETURN_STATE_CONFLICT") return "Transizione non valida per lo stato attuale del reso.";
  if (code === "RETURN_REFUND_MISMATCH") return "La pratica rimborso non appartiene allo stesso ordine/cliente.";
  if (code === "RETURN_REFUND_ALREADY_LINKED") return "Questo reso è già collegato a una pratica rimborso diversa.";
  if (code === "RETURN_INVENTORY_MISSING") return "Inventario SKU mancante: nessun reintegro delle scorte è stato applicato.";
  if (code === "ADMIN_FORBIDDEN") return "Profilo non autorizzato come amministratore.";
  return code;
}

export function AdminReturnsPanel() {
  const configured = isFirebaseClientConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it");
    if (!query) return items;
    return items.filter((item) => `${item.returnCase.id} ${item.returnCase.orderId} ${item.returnCase.email} ${item.returnCase.reasonCode}`
      .toLocaleLowerCase("it")
      .includes(query));
  }, [items, search]);

  async function load(targetUser: User) {
    setNotice("");
    try {
      const page = await apiRequest<ReturnPage>(targetUser, "/api/admin/returns");
      setItems(page.items);
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

  async function runAction(id: string, body: Record<string, unknown>, success: string) {
    if (!user || busyId) return;
    setBusyId(id);
    setNotice("");
    try {
      await apiRequest(user, `/api/admin/returns/${encodeURIComponent(id)}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load(user);
      setNotice(success);
    } catch (error) {
      setNotice(message(error instanceof Error ? error.message : String(error)));
      await load(user);
    } finally {
      setBusyId(null);
    }
  }

  async function transit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(id, {
      action: "in_transit",
      provider: String(form.get("provider") ?? ""),
      trackingCode: String(form.get("trackingCode") ?? ""),
      trackingUrl: String(form.get("trackingUrl") ?? ""),
    }, "Rientro segnato in transito.");
  }

  async function inspect(event: FormEvent<HTMLFormElement>, item: ReturnItem) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lines = item.returnCase.lines.map((line) => ({
      variantId: line.variantId,
      receivedQuantity: Number(form.get(`received:${line.variantId}`) ?? 0),
      restockQuantity: Number(form.get(`restock:${line.variantId}`) ?? 0),
    }));
    await runAction(item.returnCase.id, { action: "inspect", lines }, "Ispezione registrata. Solo le quantità indicate per il reintegro sono rientrate nell'inventario.");
  }

  async function linkRefund(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction(id, { action: "link_refund", refundCaseId: String(form.get("refundCaseId") ?? "") }, "Pratica rimborso collegata al reso.");
  }

  if (!configured) return <section className={styles.center}><p>Firebase Web SDK non configurato.</p></section>;
  if (!authReady) return <section className={styles.center}><p>AUTENTICAZIONE / VERIFICA</p></section>;
  if (!user) {
    return (
      <section className={styles.center}>
        <form className={styles.login} onSubmit={login}>
          <p className={styles.kicker}>UNSAID / OPERAZIONI RESI</p>
          <h1>Resi.</h1>
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
        <div><p className={styles.kicker}>UNSAID / RESI</p><strong>Controllo RMA</strong></div>
        <div className={styles.session}><span>{user.email}</span><button onClick={() => void signOut(getAuth(getFirebaseClientApp()))}>Esci</button></div>
      </header>

      <div className={styles.policy}>
        <strong>RESO FISICO ≠ RIMBORSO</strong>
        <span>Ricezione, ispezione, reintegro scorte e movimento di denaro restano stati distinti.</span>
      </div>

      <div className={styles.toolbar}>
        <input type="search" placeholder="Ordine, RMA, email, motivo…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button onClick={() => void load(user)}>Aggiorna</button>
      </div>

      <div className={styles.list}>
        {filtered.map((item) => {
          const entry = item.returnCase;
          const busy = busyId === entry.id;
          return (
            <article key={entry.id} data-state={entry.status}>
              <div className={styles.head}>
                <div><small>{formatDate(entry.createdAt)}</small><strong>{entry.orderId}</strong><span>{entry.email}</span></div>
                <strong>{returnStatusLabel(entry.status)}</strong>
              </div>
              <p>{reasonLabel(entry.reasonCode)}{entry.note ? ` / ${entry.note}` : ""}</p>
              <div className={styles.lines}>
                {entry.lines.map((line) => (
                  <div key={line.variantId}>
                    <strong>{line.title} / {line.size}</strong>
                    <span>{line.sku}</span>
                    <span>richiesti ×{line.quantity} / {formatMoney(line.unitPrice)}</span>
                    {line.receivedQuantity !== undefined ? <span>ricevuti ×{line.receivedQuantity} / reintegrati ×{line.restockedQuantity ?? 0}</span> : null}
                  </div>
                ))}
              </div>

              {entry.status === "requested" ? (
                <div className={styles.actions}>
                  <button disabled={busy} onClick={() => void runAction(entry.id, { action: "approve" }, "Reso approvato.")}>Approva</button>
                  <button className={styles.secondary} disabled={busy} onClick={() => void runAction(entry.id, { action: "reject" }, "Reso rifiutato.")}>Rifiuta</button>
                </div>
              ) : null}

              {entry.status === "approved" ? (
                <form className={styles.actionForm} onSubmit={(event) => void transit(event, entry.id)}>
                  <input name="provider" placeholder="Corriere rientro (opzionale)" maxLength={80} />
                  <input name="trackingCode" placeholder="Codice di tracciamento (opzionale)" maxLength={120} />
                  <input name="trackingUrl" placeholder="https:// tracciamento (opzionale)" maxLength={500} />
                  <button disabled={busy}>Segna in rientro</button>
                  <button type="button" className={styles.secondary} disabled={busy} onClick={() => void runAction(entry.id, { action: "received" }, "Reso ricevuto.")}>Ricevuto senza tracciamento</button>
                </form>
              ) : null}

              {entry.status === "in_transit" ? (
                <div className={styles.actions}>
                  <button disabled={busy} onClick={() => void runAction(entry.id, { action: "received" }, "Reso ricevuto.")}>Segna ricevuto</button>
                  {entry.inboundShipment?.trackingUrl ? <a href={entry.inboundShipment.trackingUrl} target="_blank" rel="noreferrer">Tracciamento rientro</a> : null}
                </div>
              ) : null}

              {entry.status === "received" ? (
                <form className={styles.inspect} onSubmit={(event) => void inspect(event, item)}>
                  <strong>ISPEZIONE / REINTEGRO SCORTE</strong>
                  {entry.lines.map((line) => (
                    <div className={styles.inspectLine} key={line.variantId}>
                      <span>{line.sku} / richiesti {line.quantity}</span>
                      <label>Ricevuti<input name={`received:${line.variantId}`} type="number" min="0" max={line.quantity} defaultValue={line.quantity} required /></label>
                      <label>Reintegro<input name={`restock:${line.variantId}`} type="number" min="0" max={line.quantity} defaultValue="0" required /></label>
                    </div>
                  ))}
                  <button disabled={busy}>Conferma ispezione</button>
                </form>
              ) : null}

              {(entry.status === "inspected" || entry.status === "closed") ? (
                <div className={styles.postInspect}>
                  {entry.refundCaseId ? <code>rimborso: {entry.refundCaseId}</code> : (
                    <form className={styles.linkRefund} onSubmit={(event) => void linkRefund(event, entry.id)}>
                      <input name="refundCaseId" placeholder="ID pratica rimborso da /admin/refunds" required />
                      <button disabled={busy}>Collega rimborso</button>
                    </form>
                  )}
                  {entry.status === "inspected" ? <button className={styles.secondary} disabled={busy} onClick={() => void runAction(entry.id, { action: "close" }, "Pratica reso chiusa.")}>Chiudi RMA</button> : <strong>RMA CHIUSA</strong>}
                </div>
              ) : null}
            </article>
          );
        })}
        {!filtered.length ? <p className={styles.empty}>Nessuna pratica reso.</p> : null}
      </div>
      {notice ? <div className={styles.toast} role="status">{notice}</div> : null}
    </section>
  );
}
