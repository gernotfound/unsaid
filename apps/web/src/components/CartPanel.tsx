"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GarmentColor, GarmentSize, Money } from "@unsaid/domain";
import {
  readCart,
  removeCartLine,
  setCartLineQuantity,
  type CartLine,
} from "../lib/cart";
import styles from "./CartPanel.module.css";

type ValidatedLine = {
  variantId: string;
  catalogId: string;
  slug: string;
  title: string;
  size: GarmentSize;
  garmentColor: GarmentColor;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  available: number;
  image: string | null;
};

type Issue = {
  variantId: string;
  reason: "invalid_line" | "variant_unavailable" | "product_unavailable" | "insufficient_stock";
  available?: number;
};

type ValidationResponse = {
  lines: ValidatedLine[];
  issues: Issue[];
  subtotal: Money;
  shopEnabled: boolean;
  checkoutEnabled: boolean;
  error?: string;
};

function formatMoney(money: Money) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: money.currency }).format(money.amountCents / 100);
}

function issueLabel(issue: Issue | undefined) {
  if (!issue) return "Non disponibile";
  if (issue.reason === "insufficient_stock") return issue.available ? `Solo ${issue.available} disponibili` : "Esaurito";
  if (issue.reason === "variant_unavailable") return "Taglia non più disponibile";
  if (issue.reason === "product_unavailable") return "Prodotto non disponibile alla vendita";
  return "Riga carrello non valida";
}

export function CartPanel({
  shopEnabled,
  checkoutPreparationEnabled,
}: {
  shopEnabled: boolean;
  checkoutPreparationEnabled: boolean;
}) {
  const [localLines, setLocalLines] = useState<CartLine[]>([]);
  const [validated, setValidated] = useState<ValidationResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");

  const validate = useCallback(async (lines: CartLine[]) => {
    setLocalLines(lines);
    setNotice("");
    if (!lines.length) {
      setValidated({
        lines: [],
        issues: [],
        subtotal: { amountCents: 0, currency: "EUR" },
        shopEnabled,
        checkoutEnabled: false,
      });
      setBusy(false);
      return;
    }

    setBusy(true);
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
      setNotice("Impossibile verificare prezzo e disponibilità. Riprova.");
    } finally {
      setBusy(false);
    }
  }, [shopEnabled]);

  useEffect(() => {
    void validate(readCart());
  }, [validate]);

  const resolved = useMemo(
    () => new Map((validated?.lines ?? []).map((line) => [line.variantId, line])),
    [validated],
  );
  const issues = useMemo(
    () => new Map((validated?.issues ?? []).map((issue) => [issue.variantId, issue])),
    [validated],
  );
  const cartReady = Boolean(
    validated &&
    validated.lines.length > 0 &&
    validated.issues.length === 0 &&
    validated.lines.length === localLines.length,
  );

  function changeQuantity(variantId: string, quantity: number) {
    void validate(setCartLineQuantity(variantId, quantity));
  }

  function remove(variantId: string) {
    void validate(removeCartLine(variantId));
  }

  if (!localLines.length && !busy) {
    return (
      <section className={styles.empty}>
        <p className={styles.kicker}>CARRELLO / 00</p>
        <h2>ANCORA<br />NIENTE.</h2>
        <p>Il carrello è vuoto. L&apos;archivio resta navigabile anche mentre le vendite sono chiuse.</p>
        <Link href="/shop">Apri archivio →</Link>
      </section>
    );
  }

  return (
    <div className={styles.cart}>
      <section className={styles.lines} aria-busy={busy}>
        {localLines.map((local) => {
          const line = resolved.get(local.variantId);
          const issue = issues.get(local.variantId);
          return (
            <article className={styles.line} key={local.variantId}>
              <div className={styles.media}>
                {line?.image ? <img src={line.image} alt="" /> : <span aria-hidden="true">UNSAID</span>}
              </div>
              <div className={styles.identity}>
                <p className={styles.kicker}>{line?.catalogId ?? local.productId} / {local.size}</p>
                {line ? <Link href={`/product/${line.slug}`}>{line.title}</Link> : <strong>{local.productId}</strong>}
                <span>{line ? `${line.garmentColor} / ${line.size}` : issueLabel(issue)}</span>
              </div>
              <div className={styles.quantity}>
                <span>QTÀ</span>
                <div>
                  <button type="button" aria-label="Riduci quantità" disabled={busy || local.quantity <= 1} onClick={() => changeQuantity(local.variantId, local.quantity - 1)}>−</button>
                  <strong>{local.quantity}</strong>
                  <button type="button" aria-label="Aumenta quantità" disabled={busy || !line || local.quantity >= Math.min(20, line.available)} onClick={() => changeQuantity(local.variantId, local.quantity + 1)}>+</button>
                </div>
              </div>
              <div className={styles.price}>
                <strong>{line ? formatMoney(line.lineTotal) : "—"}</strong>
                {line ? <span>{formatMoney(line.unitPrice)} / unità</span> : <span className={styles.problem}>{issueLabel(issue)}</span>}
              </div>
              <button className={styles.remove} type="button" disabled={busy} onClick={() => remove(local.variantId)}>Rimuovi</button>
            </article>
          );
        })}
        {busy ? <p className={styles.checking}>SISTEMA / VERIFICA PREZZO + SCORTE…</p> : null}
        {notice ? <p className={styles.problem} role="status">{notice}</p> : null}
      </section>

      <aside className={styles.summary}>
        <p className={styles.kicker}>ORDINE / ANTEPRIMA</p>
        <div className={styles.total}>
          <span>Subtotale</span>
          <strong>{validated ? formatMoney(validated.subtotal) : "—"}</strong>
        </div>
        <div className={styles.rule} />
        <p>Prezzi e scorte mostrati qui arrivano dal sistema. Il contenuto di localStorage non è mai considerato autorevole.</p>
        {!shopEnabled ? <div className={styles.gate}><strong>VENDITE / DISATTIVATE</strong><span>Il carrello è strutturalmente pronto, ma gli acquisti restano disattivati.</span></div> : null}
        {checkoutPreparationEnabled && cartReady && !busy ? (
          <Link className={styles.checkoutLink} href="/checkout">Continua alla conferma ordine →</Link>
        ) : (
          <button type="button" disabled>Conferma ordine non ancora attiva</button>
        )}
        <Link href="/account">Area personale →</Link>
      </aside>
    </div>
  );
}
