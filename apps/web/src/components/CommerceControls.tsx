"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GARMENT_SIZES, type GarmentColor, type GarmentSize } from "@unsaid/domain";
import { addCartLine } from "../lib/cart";
import styles from "./CommerceControls.module.css";

type VariantOption = {
  variantId: string;
  size: GarmentSize;
  available: number;
};

type Props = {
  productId: string;
  garmentColor: GarmentColor;
  variants: readonly VariantOption[];
  shopEnabled: boolean;
};

export function CommerceControls({ productId, garmentColor, variants, shopEnabled }: Props) {
  const [size, setSize] = useState<GarmentSize | null>(null);
  const [feedback, setFeedback] = useState("");
  const bySize = useMemo(() => new Map(variants.map((variant) => [variant.size, variant])), [variants]);
  const selected = size ? bySize.get(size) ?? null : null;

  function addToCart() {
    if (!shopEnabled || !size || !selected || selected.available < 1) return;
    addCartLine({
      variantId: selected.variantId,
      productId,
      size,
      quantity: 1,
    });
    setFeedback(`${size} aggiunta al carrello.`);
  }

  return (
    <div className={styles.commerce} data-shop-enabled={shopEnabled ? "true" : "false"}>
      <div className={styles.heading}>
        <p className={styles.label}>Taglia / {garmentColor === "white" ? "white" : "black"}</p>
        <span>IT only</span>
      </div>
      <div className={styles.sizes} role="group" aria-label="Seleziona taglia">
        {GARMENT_SIZES.map((item) => {
          const option = bySize.get(item);
          const soldOut = !option || option.available < 1;
          return (
            <button
              className={styles.size}
              data-selected={size === item ? "true" : "false"}
              data-sold-out={soldOut ? "true" : "false"}
              key={item}
              type="button"
              aria-pressed={size === item}
              disabled={soldOut}
              title={soldOut ? `${item} non disponibile` : `${item}: ${option.available} disponibili`}
              onClick={() => {
                setSize(item);
                setFeedback("");
              }}
            >
              <span>{item}</span>
              {soldOut ? <small>SOLD</small> : null}
            </button>
          );
        })}
      </div>
      <button
        className={styles.add}
        type="button"
        disabled={!shopEnabled || !selected || selected.available < 1}
        onClick={addToCart}
      >
        {shopEnabled ? (selected ? "Aggiungi al carrello" : "Seleziona una taglia") : "Shop opening soon"}
      </button>
      <p className={styles.note}>
        {shopEnabled
          ? "Prezzo e disponibilità verranno ricontrollati dal server nel carrello e al checkout."
          : "Taglie e stock arrivano dal sistema commerce reale; acquisto e checkout restano disattivati dal gate di lancio."}
      </p>
      {feedback ? (
        <p className={styles.feedback} aria-live="polite">
          {feedback} <Link href="/cart">Apri carrello →</Link>
        </p>
      ) : null}
    </div>
  );
}
