"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Order, ReturnCase, ReturnReasonCode } from "@unsaid/domain";
import styles from "./CustomerReturnsPanel.module.css";

const REASONS: readonly { value: ReturnReasonCode; label: string }[] = [
  { value: "changed_mind", label: "Ho cambiato idea" },
  { value: "size_issue", label: "Taglia / vestibilità" },
  { value: "damaged", label: "Articolo danneggiato" },
  { value: "wrong_item", label: "Articolo errato" },
  { value: "other", label: "Altro" },
];

type Props = {
  orders: readonly Order[];
  returns: readonly ReturnCase[];
  returnsEnabled: boolean;
  returnsRequested: boolean;
};

function statusLabel(status: ReturnCase["status"]) {
  const labels: Record<ReturnCase["status"], string> = {
    requested: "richiesto",
    approved: "approvato",
    rejected: "rifiutato",
    in_transit: "in rientro",
    received: "ricevuto",
    inspected: "ispezionato",
    closed: "chiuso",
  };
  return labels[status];
}

function errorMessage(code: string) {
  if (code === "RETURNS_DISABLED") return "Le richieste di reso non sono ancora aperte.";
  if (code === "ORDER_NOT_RETURN_ELIGIBLE") return "Il reso può essere richiesto solo per un ordine consegnato.";
  if (code === "RETURN_ALREADY_EXISTS") return "Esiste già una pratica di reso per questo ordine.";
  if (code === "RETURN_LINES_REQUIRED" || code === "INVALID_RETURN_LINES" || code === "INVALID_RETURN_QUANTITY") return "Seleziona almeno un articolo e una quantità valida.";
  return "Richiesta di reso non riuscita. Riprova.";
}

export function CustomerReturnsPanel({ orders, returns, returnsEnabled, returnsRequested }: Props) {
  const router = useRouter();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const activeOrder = orders.find((order) => order.id === activeOrderId) ?? null;
  const deliveredWithoutReturn = orders.filter((order) =>
    order.status === "delivered" && !returns.some((entry) => entry.orderId === order.id),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOrder) return;
    const form = new FormData(event.currentTarget);
    const lines = activeOrder.lines
      .map((line) => ({ variantId: line.variantId, quantity: Number(form.get(`quantity:${line.variantId}`) ?? 0) }))
      .filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/account/returns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: activeOrder.id,
          reasonCode: String(form.get("reasonCode") ?? ""),
          note: String(form.get("note") ?? ""),
          lines,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "RETURN_REQUEST_FAILED");
      setActiveOrderId(null);
      setFeedback("Richiesta di reso registrata. Lo stato sarà aggiornato nel tuo profilo.");
      router.refresh();
    } catch (error) {
      setFeedback(errorMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div><p className={styles.kicker}>RESI / RMA</p><span>04</span></div>
        {returnsEnabled && deliveredWithoutReturn.length ? (
          <button type="button" onClick={() => setActiveOrderId((value) => value ? null : deliveredWithoutReturn[0]!.id)}>
            {activeOrderId ? "Chiudi" : "+ Richiedi reso"}
          </button>
        ) : null}
      </div>

      {!returnsRequested ? (
        <p className={styles.muted}>Il flusso resi è predisposto ma non è ancora aperto.</p>
      ) : !returnsEnabled ? (
        <p className={styles.warning}>Le richieste reso resteranno bloccate finché la politica commerciale e legale non sarà approvata.</p>
      ) : null}

      {returns.length ? (
        <div className={styles.history}>
          {returns.map((entry) => (
            <article key={entry.id} data-state={entry.status}>
              <div><strong>{entry.orderId}</strong><span>{statusLabel(entry.status).toUpperCase()}</span></div>
              <small>{new Date(entry.createdAt).toLocaleDateString("it-IT")} / {REASONS.find((reason) => reason.value === entry.reasonCode)?.label ?? "Altro"}</small>
              <p>{entry.lines.map((line) => `${line.title} ${line.size} ×${line.quantity}`).join(" · ")}</p>
              {entry.inboundShipment?.trackingUrl ? <a href={entry.inboundShipment.trackingUrl} target="_blank" rel="noreferrer">Tracciamento rientro</a> : null}
              {entry.refundCaseId ? <code>rimborso: {entry.refundCaseId}</code> : null}
            </article>
          ))}
        </div>
      ) : <p className={styles.muted}>Nessuna pratica di reso.</p>}

      {returnsEnabled && activeOrder ? (
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.formHead}>
            <div><small>ORDINE</small><strong>{activeOrder.id}</strong></div>
            {deliveredWithoutReturn.length > 1 ? (
              <select value={activeOrder.id} onChange={(event) => setActiveOrderId(event.target.value)}>
                {deliveredWithoutReturn.map((order) => <option value={order.id} key={order.id}>{order.id}</option>)}
              </select>
            ) : null}
          </div>
          <div className={styles.lines}>
            {activeOrder.lines.map((line) => (
              <label key={line.variantId}>
                <span>{line.title} / {line.size} / massimo {line.quantity}</span>
                <input name={`quantity:${line.variantId}`} type="number" inputMode="numeric" min="0" max={line.quantity} defaultValue="0" />
              </label>
            ))}
          </div>
          <label><span>Motivo</span><select name="reasonCode" defaultValue="changed_mind">{REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label>
          <label><span>Nota (opzionale)</span><textarea name="note" maxLength={1000} rows={3} /></label>
          <button className={styles.primary} type="submit" disabled={busy}>{busy ? "Invio…" : "Invia richiesta"}</button>
        </form>
      ) : null}
      {feedback ? <p className={styles.feedback} aria-live="polite">{feedback}</p> : null}
    </section>
  );
}
